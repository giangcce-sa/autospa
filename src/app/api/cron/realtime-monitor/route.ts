import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { runRealtimeMonitor } from "@/lib/realtime-monitor";
import { finishJobRun, logActivity, startJobRun } from "@/lib/activity-log";

export async function GET(req: NextRequest) {
  const denied = verifyCronAuth(req);
  if (denied) return denied;

  const job = await startJobRun("realtime_monitor", "cron", "Scan realtime business signals").catch(() => null);
  try {
    const result = await runRealtimeMonitor();
    if (job) {
      await finishJobRun(job.id, {
        status: "completed",
        summary: "Realtime monitor completed",
        metrics: result,
      }).catch(() => null);
    }
    await logActivity({
      type: "job_run",
      title: "Realtime monitor completed",
      detail: "Signals scanned",
      href: "/listening",
      severity: "success",
      source: "cron",
      metadata: result,
    }).catch(() => null);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi";
    if (job) {
      await finishJobRun(job.id, {
        status: "failed",
        summary: "Realtime monitor failed",
        error: msg,
      }).catch(() => null);
    }
    await logActivity({
      type: "job_run",
      title: "Realtime monitor failed",
      detail: msg,
      href: "/listening",
      severity: "danger",
      source: "cron",
    }).catch(() => null);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
