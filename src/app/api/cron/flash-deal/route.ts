import { NextRequest, NextResponse } from "next/server";
import { runFlashDealDetection } from "@/lib/flash-deal-engine";
import { verifyCronAuth } from "@/lib/cron-auth";
import { routeErrorResponse } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  const denied = verifyCronAuth(req);
  if (denied) return denied;

  try {
    const { gaps, deals } = await runFlashDealDetection();

    if (gaps.length === 0) {
      return NextResponse.json({ success: true, message: "Không có slot trống cần flash deal" });
    }

    return NextResponse.json({
      success: true,
      data: {
        gaps: gaps.length,
        deals: deals.length,
        results: deals,
        nextStep: "Chọn Facebook Page, persist Post draft và phân phối qua canonical Publishing.",
      },
    });
  } catch (e) {
    return routeErrorResponse(e, "Lỗi khi chạy flash deal");
  }
}
