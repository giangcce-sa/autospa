import { NextResponse } from "next/server";
import { runFlashDealDetection, postFlashDeal } from "@/lib/flash-deal-engine";
import { prisma } from "@/lib/db";
import { sendAlert } from "@/lib/telegram";

export async function GET() {
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
        // Supervised: send to Telegram for approval
        await sendAlert(
          `Flash Deal Đề xuất — ${deal.slot.label}`,
          `Lịch trống ${Math.round((1 - deal.slot.fillRate) * 100)}% · Giảm ${deal.discountPct}%\n\nCaption:\n${deal.caption.slice(0, 400)}\n\nVào Flash Deal để phê duyệt và đăng.`,
          "info"
        );
        results.push({ ...deal, posted: null, status: "pending_approval" });
      }
    }

    return NextResponse.json({ success: true, data: { gaps: gaps.length, deals: results.length, results } });
  } catch (e) {
    return NextResponse.json({ error: String(e), success: false }, { status: 500 });
  }
}
