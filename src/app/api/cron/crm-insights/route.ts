import { NextRequest, NextResponse } from "next/server";
import { runLoggedJob } from "@/lib/activity-log";
import { updateCachedCLV } from "@/lib/clv-engine";
import { verifyCronAuth } from "@/lib/cron-auth";
import { routeErrorResponse } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  const denied = verifyCronAuth(req);
  if (denied) return denied;

  try {
    const updated = await runLoggedJob(
      "crm_insights",
      "cron",
      updateCachedCLV,
      (count) => `Updated CLV for ${count} customer(s)`,
    );
    return NextResponse.json({ success: true, data: { updated } });
  } catch (error) {
    return routeErrorResponse(error, "Lỗi khi cập nhật CLV");
  }
}
