import { accessErrorResponse, requireUser } from "@/lib/page-access";
import { generateAnalyticsReport } from "@/lib/sub-agents/analytics-agent";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const requestSchema = z.object({ timeframe: z.enum(["7d", "30d"]) });

export async function POST(req: NextRequest) {
  try {
    await requireUser({ owner: true });
    const { timeframe } = requestSchema.parse(await req.json());
    const report = await generateAnalyticsReport(timeframe);
    return NextResponse.json({ data: { ...report, provenance: { scope: "account" } }, success: true });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    const message = error instanceof Error ? error.message : "Lỗi";
    return NextResponse.json({ error: message, success: false }, { status: error instanceof z.ZodError ? 400 : 500 });
  }
}
