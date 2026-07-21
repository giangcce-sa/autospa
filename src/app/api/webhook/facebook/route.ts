import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateContent } from "@/lib/claude";
import { replyToFbComment, replyToFbConversation } from "@/lib/facebook";
import { getOrCreateConversation, processIncomingMessage, executeHandoff } from "@/lib/lead-agent";
import { matchMessageRule } from "@/lib/message-rules";
import { verifyWebhookSignature } from "@/lib/webhook-security";

// Facebook webhook verification (GET)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const settings = await prisma.settings.findFirst();
  if (mode === "subscribe" && settings?.webhookVerifyToken && token === settings.webhookVerifyToken) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("Forbidden — verify token không khớp", { status: 403 });
}

// Facebook webhook events (POST)
export async function POST(req: NextRequest) {
  const rawBody = Buffer.from(await req.arrayBuffer());
  const signature = verifyWebhookSignature({
    rawBody,
    signature: req.headers.get("x-hub-signature-256"),
    secret: process.env.FACEBOOK_APP_SECRET,
  });
  if (!signature.allowed) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.object !== "page") return NextResponse.json({ status: "ok" });

  const settings = await prisma.settings.findFirst();
  if (settings?.webhookMode !== "auto") return NextResponse.json({ status: "ok" });

  for (const entry of (body.entry as Record<string, unknown>[]) ?? []) {
    const entryPageId = entry.id as string | undefined;
    const fbPage = entryPageId
      ? await prisma.facebookPage.findFirst({ where: { fbPageId: entryPageId, isActive: true } })
      : null;
    if (!fbPage) continue;

    for (const change of (entry.changes as Record<string, unknown>[]) ?? []) {
      const val = change.value as Record<string, unknown>;
      if (change.field === "feed" && val?.item === "comment" && val?.verb === "add") {
        await handleComment(val, settings, fbPage.id).catch(console.error);
      }
    }

    for (const msg of (entry.messaging as Record<string, unknown>[]) ?? []) {
      const message = msg.message as Record<string, unknown> | undefined;
      if (message?.text && !message?.is_echo) {
        await handleMessage(msg, settings, fbPage.id).catch(console.error);
      }
    }
  }

  return NextResponse.json({ status: "ok" });
}

async function handleComment(
  val: Record<string, unknown>,
  settings: { autoReplyComments: boolean } | null,
  facebookPageId: string
) {
  const fbCommentId = val.comment_id as string | undefined;
  const fbPostId = (val.post_id as string | undefined) ?? "";
  const from = val.from as { name?: string; id?: string } | undefined;
  const content = (val.message as string | undefined) ?? "";
  const createdTime = val.created_time ? new Date((val.created_time as number) * 1000) : new Date();

  if (!fbCommentId || !content) return;

  const exists = await prisma.postComment.findFirst({ where: { fbCommentId } });
  if (exists) return;

  let post = await prisma.post.findFirst({ where: { fbPostId, facebookPageId } });
  if (!post) {
    post = await prisma.post.create({
      data: {
        caption: "Bài đăng từ Facebook",
        platform: "facebook",
        postType: "service",
        tone: "friendly",
        status: "published",
        fbPostId,
        facebookPageId,
        publishedAt: createdTime,
      },
    });
  }

  const lower = content.toLowerCase();
  const negW = ["tệ", "xấu", "kém", "thất vọng", "chán", "không tốt", "lừa đảo", "tức", "ghét"];
  const posW = ["hay", "tốt", "tuyệt", "đẹp", "hài lòng", "thích", "ổn", "ngon", "chuyên nghiệp"];
  let sentiment = "neutral";
  if (negW.some((w) => lower.includes(w))) sentiment = "negative";
  else if (posW.some((w) => lower.includes(w))) sentiment = "positive";

  const rules = await prisma.commentRule.findMany({ where: { isActive: true } });
  const matchedRule = rules.find((r: { trigger: string; reply: string }) => lower.includes(r.trigger.toLowerCase()));
  const autoReply = matchedRule?.reply ?? null;
  const comment = await prisma.postComment.create({
    data: {
      postId: post.id,
      fbCommentId,
      facebookPageId,
      authorName: from?.name ?? "Khách hàng",
      content,
      sentiment,
      autoReply,
      isAlert: sentiment === "negative",
      createdAt: createdTime,
    },
  });

  if (settings?.autoReplyComments && autoReply) {
    try {
      await replyToFbComment(fbCommentId, autoReply, facebookPageId);
      await prisma.postComment.update({ where: { id: comment.id }, data: { isReplied: true } });
    } catch {
      // send failed, comment remains unreplied
    }
  }
}

async function handleMessage(
  msg: Record<string, unknown>,
  settings: { autoReplyMessages: boolean; automationLevel?: string; leadHandoffMode?: string; zaloApprovalRecipient?: string | null } | null,
  facebookPageId: string
) {
  const sender = msg.sender as { id?: string } | undefined;
  const message = msg.message as { text?: string; mid?: string } | undefined;
  const timestamp = msg.timestamp as number | undefined;
  const senderId = sender?.id ?? "";
  const text = message?.text ?? "";
  const fbMessageId = message?.mid ?? "";

  if (!senderId || !text || !fbMessageId) return;

  const exists = await prisma.inboxMessage.findUnique({ where: { fbMessageId } });
  if (exists) return;

  const inboxMsg = await prisma.inboxMessage.create({
    data: {
      senderId,
      senderName: "Khách hàng Facebook",
      message: text,
      fbMessageId,
      facebookPageId,
      createdAt: timestamp ? new Date(timestamp) : new Date(),
    },
  });

  // MessageRule pattern matching — runs first, before Lead Agent
  const ruleMatch = await matchMessageRule(text, "facebook");
  if (ruleMatch) {
    try {
      await replyToFbConversation(senderId, ruleMatch.reply, facebookPageId);
      await prisma.inboxMessage.update({
        where: { id: inboxMsg.id },
        data: { reply: ruleMatch.reply, isAutoReply: true },
      });
      return;
    } catch {
      // rule send failed — fall through to Lead Agent / generic AI
    }
  }

  // Attribution from FB referral payload (m.me/[page]?ref=postId__campaign:abc__ad:xyz)
  const referral = msg.referral as { ref?: string } | undefined;
  const postback = msg.postback as { referral?: { ref?: string } } | undefined;
  const refStr = referral?.ref ?? postback?.referral?.ref;
  const attribution: { fromPostId?: string; fromCampaignId?: string; fromAdId?: string } = {};
  if (refStr) {
    for (const part of refStr.split("__")) {
      if (part.startsWith("campaign:")) attribution.fromCampaignId = part.slice(9);
      else if (part.startsWith("ad:")) attribution.fromAdId = part.slice(3);
      else if (part.startsWith("post:")) attribution.fromPostId = part.slice(5);
      else if (!attribution.fromPostId) attribution.fromPostId = part; // bare ref → treat as postId
    }
  }

  // Lead Agent — runs when automationLevel is semi or full
  if (settings?.automationLevel && settings.automationLevel !== "supervised") {
    try {
      const conv = await getOrCreateConversation(senderId, facebookPageId, "facebook", attribution);
      if (!conv.isComplete) {
        const { replyText, isComplete } = await processIncomingMessage(conv.id, text);
        if (replyText) {
          await replyToFbConversation(senderId, replyText, facebookPageId);
          await prisma.inboxMessage.update({ where: { id: inboxMsg.id }, data: { reply: replyText, isAutoReply: true } });
        }
        if (isComplete) {
          await executeHandoff(conv.id, settings.leadHandoffMode ?? "staff", settings.zaloApprovalRecipient);
        }
      }
      return;
    } catch {
      // Lead Agent failed — fall through to simple auto-reply
    }
  }

  // Simple auto-reply (supervised mode or Lead Agent disabled)
  if (settings?.autoReplyMessages) {
    try {
      const reply = await generateContent(
        `Khách nhắn: "${text}"\nTrả lời ngắn gọn, thân thiện:`,
        "Bạn là nhân viên tư vấn của spa, trả lời tin nhắn khách hàng trên Facebook. Ngắn gọn, chuyên nghiệp, luôn mời khách đặt lịch."
      );
      await replyToFbConversation(senderId, reply, facebookPageId);
      await prisma.inboxMessage.update({ where: { id: inboxMsg.id }, data: { reply, isAutoReply: true } });
    } catch {
      // auto-reply failed
    }
  }
}
