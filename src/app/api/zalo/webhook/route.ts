import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { findApprovalByCode } from "@/lib/approval-gate";
import { executeApproval } from "@/lib/approval-executor";
import { getOrCreateConversation, processIncomingMessage, executeHandoff } from "@/lib/lead-agent";
import { postToZalo } from "@/lib/zalo";
import { matchMessageRule } from "@/lib/message-rules";
import { decryptSecret } from "@/lib/secrets-crypto";
import { secureCompare, verifyWebhookSignature } from "@/lib/webhook-security";

// Zalo OA webhook verification
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const verifyToken = searchParams.get("verify_token");
  const settings = await prisma.settings.findFirst();
  const expected = decryptSecret(settings?.webhookVerifyToken);
  if (verifyToken && expected && secureCompare(verifyToken, expected)) {
    return new Response(verifyToken, { status: 200 });
  }
  return new Response("ok", { status: 200 });
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = verifyWebhookSignature({
    rawBody,
    signature: req.headers.get("x-zalo-signature"),
    secret: process.env.ZALO_WEBHOOK_SECRET,
  });
  if (!signature.allowed) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = JSON.parse(rawBody); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const eventName = body.event_name as string | undefined;
  if (eventName !== "user_send_text") return NextResponse.json({ status: "ok" });

  const sender = (body.sender as Record<string, unknown> | undefined);
  const message = (body.message as Record<string, unknown> | undefined);
  const senderId = sender?.id as string | undefined;
  const text = (message?.text as string | undefined)?.trim() ?? "";

  if (!senderId || !text) return NextResponse.json({ status: "ok" });

  // Approval codes are deliberately longer than normal chat content.
  const approvalMatch = text.match(/^([YNyn])([A-F0-9]{10})$/i);
  if (approvalMatch) {
    const approvalSettings = await prisma.settings.findFirst({
      select: { zaloApprovalRecipient: true },
    });
    if (!approvalSettings?.zaloApprovalRecipient || senderId !== approvalSettings.zaloApprovalRecipient) {
      return NextResponse.json({ error: "Approval sender is not allowed" }, { status: 403 });
    }
    const decision = approvalMatch[1].toUpperCase() === "Y" ? "approved" : "rejected";
    const code = approvalMatch[2].toUpperCase();
    const approval = await findApprovalByCode(code);
    if (approval) await executeApproval(approval.id, decision as "approved" | "rejected").catch(() => null);

    return NextResponse.json({ status: "ok" });
  }

  // MessageRule pattern matching — runs first, before Lead Agent
  const ruleMatch = await matchMessageRule(text, "zalo");
  if (ruleMatch) {
    try {
      await postToZalo(ruleMatch.reply, undefined, senderId);
      return NextResponse.json({ status: "ok" });
    } catch {
      // rule send failed — fall through to Lead Agent
    }
  }

  // Lead Agent — runs when automationLevel is semi or full
  const settings = await prisma.settings.findFirst();
  if (settings?.automationLevel && settings.automationLevel !== "supervised") {
    try {
      const conv = await getOrCreateConversation(senderId, null, "zalo");
      if (!conv.isComplete) {
        const { replyText, isComplete } = await processIncomingMessage(conv.id, text);
        if (replyText) {
          await postToZalo(replyText, undefined, senderId);
        }
        if (isComplete) {
          await executeHandoff(conv.id, settings.leadHandoffMode ?? "staff", settings.zaloApprovalRecipient);
        }
      }
    } catch {
      // Lead Agent failed — reply generic if autoReplyMessages is on
      if (settings?.autoReplyMessages) {
        try {
          await postToZalo("Xin chào! Spa sẽ liên hệ bạn sớm nhé 😊", undefined, senderId);
        } catch {}
      }
    }
  }

  return NextResponse.json({ status: "ok" });
}
