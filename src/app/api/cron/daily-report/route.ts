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

export async function GET(req: NextRequest) {
  const denied = verifyCronAuth(req);
  if (denied) return denied;

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
    const npsRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "batch-send", hoursAfter: 2 }),
    });
    results.nps = (await npsRes.json()).data ?? {};
  } catch (e) {
    results.npsError = String(e);
  }

  return NextResponse.json(results);
}
