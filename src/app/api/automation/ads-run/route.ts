import { NextRequest, NextResponse } from "next/server";
import { runAdsOptimization } from "@/lib/ads-optimizer";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await runAdsOptimization({
      trigger: "manual",
      dryRun: body.dryRun !== false,
      ignoreCooldown: body.ignoreCooldown === true,
    });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
