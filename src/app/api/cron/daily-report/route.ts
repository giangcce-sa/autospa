import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { sendDailyReport } from "@/lib/daily-report";
import { runLeadNurture } from "@/lib/lead-nurture";

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

  return NextResponse.json(results);
}
