import { NextRequest, NextResponse } from "next/server";
import { runFlashDealDetection, postFlashDeal } from "@/lib/flash-deal-engine";
import { prisma } from "@/lib/db";
import { verifyCronAuth } from "@/lib/cron-auth";
import { requestApproval } from "@/lib/approval-gate";

export async function GET(req: NextRequest) {
  const denied = verifyCronAuth(req);
  if (denied) return denied;

  try {
    const settings = await prisma.settings.findFirst();

    const { gaps, deals } = await runFlashDealDetection();

    if (gaps.length === 0) {
      return NextResponse.json({ success: true, message: "Không có slot trống cần flash deal" });
    }

    const results = [];

    for (const deal of deals as { caption: string; discountPct: number; slot: { label: string; fillRate: number } }[]) {
      if (settings?.automationLevel === "full") {
        // Auto mode: post immediately
        const posted = await postFlashDeal(deal.caption);
        results.push({ ...deal, posted });
      } else {
        const approvalId = await requestApproval("flash_deal", {
          description: `${deal.slot.label} · giảm ${deal.discountPct}%`,
          caption: deal.caption,
          slotLabel: deal.slot.label,
          discountPct: deal.discountPct,
        });
        results.push({ ...deal, posted: null, status: "pending_approval", approvalId });
      }
    }

    return NextResponse.json({ success: true, data: { gaps: gaps.length, deals: results.length, results } });
  } catch (e) {
    return NextResponse.json({ error: String(e), success: false }, { status: 500 });
  }
}
