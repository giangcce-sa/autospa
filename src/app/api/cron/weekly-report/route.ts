import { NextRequest, NextResponse } from "next/server";
import { sendWeeklyReport } from "@/lib/weekly-report";
import { prisma } from "@/lib/db";
import { verifyCronAuth } from "@/lib/cron-auth";
import { vietnamClock } from "@/lib/telegram-control";

export async function GET(req: NextRequest) {
  const denied = verifyCronAuth(req);
  if (denied) return denied;

  try {
    const settings = await prisma.settings.findFirst();
    if (!settings?.weeklyReportEnabled) {
      return NextResponse.json({ skipped: "disabled" });
    }
    const clock = vietnamClock();
    if (clock.day !== settings.weeklyReportDay || clock.hour !== settings.weeklyReportHour) {
      return NextResponse.json({ skipped: "outside_schedule", clock });
    }
    const oneHourAgo = new Date(Date.now() - 3_600_000);
    const alreadySent = await prisma.telegramDelivery.findFirst({
      where: { type: "weekly_report", status: "sent", createdAt: { gte: oneHourAgo } },
    });
    if (alreadySent) return NextResponse.json({ skipped: "already_sent" });

    const result = await sendWeeklyReport();
    return NextResponse.json({ success: result.ok, data: result }, { status: result.ok ? 200 : 502 });
  } catch (error) {
    return NextResponse.json({ error: String(error), success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = verifyCronAuth(req);
  if (denied) return denied;
  const result = await sendWeeklyReport();
  return NextResponse.json({ success: result.ok, data: result }, { status: result.ok ? 200 : 502 });
}
