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
import { getCanonicalRouteHref } from "@/config/routes";

export async function GET(req: NextRequest) {
  const denied = verifyCronAuth(req);
  if (denied) return denied;

  const job = await startJobRun("daily_report", "cron", "Daily automation bundle").catch(() => null);
  const results: Record<string, unknown> = {};

  try {
    await sendDailyReport();
    results.report = true;
  } catch (e) {
    console.error("report failed:", e);
    results.reportError = "Thất bại";
  }

  try {
    results.nurture = await runLeadNurture();
  } catch (e) {
    console.error("nurture failed:", e);
    results.nurtureError = "Thất bại";
  }

  try {
    results.competitorSync = await syncCompetitors();
  } catch (e) {
    console.error("competitorSync failed:", e);
    results.competitorSyncError = "Thất bại";
  }

  try {
    results.adsLibrarySync = await syncAdsLibrary();
  } catch (e) {
    console.error("adsLibrarySync failed:", e);
    results.adsLibrarySyncError = "Thất bại";
  }

  try {
    results.googleTrendsSync = await syncGoogleTrends();
  } catch (e) {
    console.error("googleTrendsSync failed:", e);
    results.googleTrendsSyncError = "Thất bại";
  }

  try {
    results.proactiveSales = await runProactiveOutreach();
  } catch (e) {
    console.error("proactiveSales failed:", e);
    results.proactiveSalesError = "Thất bại";
  }

  try {
    results.ceoOutcomes = await checkPendingOutcomes();
  } catch (e) {
    console.error("ceoOutcomes failed:", e);
    results.ceoOutcomesError = "Thất bại";
  }

  try {
    const plan = await runOrchestrator();
    results.orchestrator = {
      mode: plan.mode,
      topPriorities: plan.priorities.slice(0, 3),
      actionsCount: plan.actions.length,
    };
  } catch (e) {
    console.error("orchestrator failed:", e);
    results.orchestratorError = "Thất bại";
  }

  // NPS batch-send: trigger for appointments completed in the last 2 hours
  try {
    results.nps = await batchSendNps(2);
  } catch (e) {
    console.error("nps failed:", e);
    results.npsError = "Thất bại";
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
    href: getCanonicalRouteHref("orchestrator"),
    severity: status === "completed" ? "success" : "warning",
    source: "cron",
    metadata: results,
  }).catch(() => null);

  return NextResponse.json(results);
}
