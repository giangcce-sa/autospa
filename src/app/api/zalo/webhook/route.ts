import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveApprovalByCode } from "@/lib/approval-gate";
import { setCampaignStatus, updateCampaignBudget } from "@/lib/facebook-ads";
import { getOrCreateConversation, processIncomingMessage, executeHandoff } from "@/lib/lead-agent";
import { postToZalo } from "@/lib/zalo";
import { matchMessageRule } from "@/lib/message-rules";

// Zalo OA webhook verification
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const verifyToken = searchParams.get("verify_token");
  const settings = await prisma.settings.findFirst();
  if (verifyToken && verifyToken === settings?.webhookVerifyToken) {
    return new Response(verifyToken, { status: 200 });
  }
  return new Response("ok", { status: 200 });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ status: "ok" }); }

  const eventName = body.event_name as string | undefined;
  if (eventName !== "user_send_text") return NextResponse.json({ status: "ok" });

  const sender = (body.sender as Record<string, unknown> | undefined);
  const message = (body.message as Record<string, unknown> | undefined);
  const senderId = sender?.id as string | undefined;
  const text = (message?.text as string | undefined)?.trim() ?? "";

  if (!senderId || !text) return NextResponse.json({ status: "ok" });

  // Check for approval reply: Y1A2B or N1A2B (Y/N + 4-char code)
  const approvalMatch = text.match(/^([YNyn])([A-Z0-9]{4})$/i);
  if (approvalMatch) {
    const decision = approvalMatch[1].toUpperCase() === "Y" ? "approved" : "rejected";
    const code = approvalMatch[2].toUpperCase();
    const approval = await resolveApprovalByCode(code, decision as "approved" | "rejected");

    if (approval && decision === "approved") {
      // Execute the approved action
      const payload = approval.payload as Record<string, unknown>;
      try {
        if (approval.type === "pause_campaign") {
          await setCampaignStatus(payload.campaignId as string, "PAUSED");
        } else if (approval.type === "budget_increase") {
          await updateCampaignBudget(payload.campaignId as string, Number(payload.newBudget));
        }
      } catch { /* log silently */ }
    }

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
