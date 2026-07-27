import { NextResponse } from "next/server";
import { runAdsOptimization } from "@/lib/ads-optimizer";
import { requireUser } from "@/lib/page-access";
import { routeErrorResponse } from "@/lib/api-response";

export async function POST() {
  try {
    await requireUser({ owner: true });
    const result = await runAdsOptimization({
      trigger: "manual",
      dryRun: true,
      ignoreCooldown: false,
    });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return routeErrorResponse(error, "Lỗi khi chạy tối ưu quảng cáo");
  }
}
