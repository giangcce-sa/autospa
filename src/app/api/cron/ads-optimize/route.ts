import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { runAdsOptimization } from "@/lib/ads-optimizer";
import { routeErrorResponse } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  const denied = verifyCronAuth(req);
  if (denied) return denied;

  try {
    const result = await runAdsOptimization({ trigger: "cron" });
    return NextResponse.json(result);
  } catch (error) {
    return routeErrorResponse(error, "Lỗi khi tối ưu quảng cáo");
  }
}
