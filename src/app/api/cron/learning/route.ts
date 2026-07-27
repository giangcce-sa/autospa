import { NextRequest, NextResponse } from "next/server";
import { runAllLearningLoops } from "@/lib/learning";
import { verifyCronAuth } from "@/lib/cron-auth";
import { routeErrorResponse } from "@/lib/api-response";

// Cron: runs nightly at 02:00 (low-traffic hour)
export async function GET(req: NextRequest) {
  const denied = verifyCronAuth(req);
  if (denied) return denied;

  try {
    const result = await runAllLearningLoops();
    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    return routeErrorResponse(e, "Lỗi khi chạy learning loops");
  }
}
