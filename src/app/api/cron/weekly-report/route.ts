import { NextRequest, NextResponse } from "next/server";
import { sendWeeklyReport } from "@/lib/weekly-report";
import { prisma } from "@/lib/db";
import { verifyCronAuth } from "@/lib/cron-auth";

export async function GET(req: NextRequest) {
  const denied = verifyCronAuth(req);
  if (denied) return denied;

  try {
    const s = await prisma.settings.findFirst();
    if (!s?.weeklyReportEnabled) {
      return NextResponse.json({ success: false, message: "Weekly report đang tắt" });
    }
    const result = await sendWeeklyReport();
    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    return NextResponse.json({ error: String(e), success: false }, { status: 500 });
  }
}

// Manual trigger
export async function POST(req: NextRequest) {
  const denied = verifyCronAuth(req);
  if (denied) return denied;

  try {
    const result = await sendWeeklyReport();
    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    return NextResponse.json({ error: String(e), success: false }, { status: 500 });
  }
}
