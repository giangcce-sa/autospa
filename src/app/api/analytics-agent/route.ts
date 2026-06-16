import { generateAnalyticsReport } from "@/lib/sub-agents/analytics-agent";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const timeframe = (searchParams.get("timeframe") ?? "7d") as "7d" | "30d";
    const report = await generateAnalyticsReport(timeframe);
    return NextResponse.json({ data: report, success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}
