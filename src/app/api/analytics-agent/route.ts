import { requireUser } from "@/lib/page-access";
import { routeErrorResponse } from "@/lib/api-response";
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
    return routeErrorResponse(error, "Lỗi");
  }
}
