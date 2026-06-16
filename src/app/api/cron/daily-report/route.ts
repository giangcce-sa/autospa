import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { sendDailyReport } from "@/lib/daily-report";
import { runLeadNurture } from "@/lib/lead-nurture";
import { syncCompetitors } from "@/lib/competitor-research";
import { runProactiveOutreach } from "@/lib/proactive-sales";
import { checkPendingOutcomes } from "@/lib/ceo-memory";
import { runOrchestrator } from "@/lib/orchestrator";
import { syncAdsLibrary } from "@/lib/intelligence/ads-library";
import { syncGoogleTrends } from "@/lib/intelligence/google-trends";
import { batchSendNps } from "@/lib/feedback";
import { finishJobRun, logActivity, startJobRun } from "@/lib/activity-log";

export async function GET(req: NextRequest) {
  const denied = verifyCronAuth(req);
  if (denied) return denied;

  const job = await startJobRun("daily_report", "cron", "Daily automation bundle").catch(() => null);
  const results: Record<string, unknown> = {};

  try {
    await sendDailyReport();
    results.report = true;
  } catch (e) {
    results.reportError = String(e);
  }

  try {
    results.nurture = await runLeadNurture();
  } catch (e) {
    results.nurtureError = String(e);
  }

  try {
    results.competitorSync = await syncCompetitors();
  } catch (e) {
    results.competitorSyncError = String(e);
  }

  try {
    results.adsLibrarySync = await syncAdsLibrary();
  } catch (e) {
    results.adsLibrarySyncError = String(e);
  }

  try {
    results.googleTrendsSync = await syncGoogleTrends();
  } catch (e) {
    results.googleTrendsSyncError = String(e);
  }

  try {
    results.proactiveSales = await runProactiveOutreach();
  } catch (e) {
    results.proactiveSalesError = String(e);
  }

  try {
    results.ceoOutcomes = await checkPendingOutcomes();
  } catch (e) {
    results.ceoOutcomesError = String(e);
  }

  try {
    const plan = await runOrchestrator();
    results.orchestrator = {
      mode: plan.mode,
      topPriorities: plan.priorities.slice(0, 3),
      actionsCount: plan.actions.length,
    };
  } catch (e) {
    results.orchestratorError = String(e);
  }

  // NPS batch-send: trigger for appointments completed in the last 2 hours
  try {
    results.nps = await batchSendNps(2);
  } catch (e) {
    results.npsError = String(e);
  }

  const errorKeys = Object.keys(results).filter((key) => key.endsWith("Error"));
  const status = errorKeys.length > 0 ? "failed" : "completed";
  const summary = errorKeys.length > 0
    ? `Daily report completed with ${errorKeys.length} errors`
    : "Daily report completed";

  if (job) {
    await finishJobRun(job.id, {
      status,
      summary,
      metrics: results,
      error: errorKeys.length > 0 ? errorKeys.join(", ") : undefined,
    }).catch(() => null);
  }

  await logActivity({
    type: "job_run",
    title: status === "completed" ? "Daily automation completed" : "Daily automation needs review",
    detail: summary,
    href: "/orchestrator",
    severity: status === "completed" ? "success" : "warning",
    source: "cron",
    metadata: results,
  }).catch(() => null);

  return NextResponse.json(results);
}
