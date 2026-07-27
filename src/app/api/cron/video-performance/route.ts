import { NextRequest, NextResponse } from "next/server";
import { finishJobRun, startJobRun } from "@/lib/activity-log";
import { verifyCronAuth } from "@/lib/cron-auth";
import { syncPublishedVideoPerformance } from "@/lib/video-studio/performance-sync";
import { routeErrorResponse } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  const denied = verifyCronAuth(req);
  if (denied) return denied;
  const run = await startJobRun("video_performance", "cron", "Sync published video performance").catch(() => null);
  try {
    const results = await syncPublishedVideoPerformance();
    const synced = results.filter((item) => item.status === "synced").length;
    const failed = results.filter((item) => item.status === "failed").length;
    if (run) await finishJobRun(run.id, { status: "completed", summary: `Synced ${synced} video metric snapshot(s); ${failed} failed`, metrics: { synced, failed } }).catch(() => null);
    return NextResponse.json({ success: true, synced, failed, data: results });
  } catch (error) {
    if (run) await finishJobRun(run.id, { status: "failed", summary: "Video performance sync failed", error: "Thất bại" }).catch(() => null);
    return routeErrorResponse(error, "Lỗi khi đồng bộ hiệu suất video");
  }
}
