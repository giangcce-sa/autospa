import { NextResponse } from "next/server";
import { runAdsOptimization } from "@/lib/ads-optimizer";
import { accessErrorResponse, requireUser } from "@/lib/page-access";

export async function POST() {
  try {
    await requireUser({ owner: true });
    const result = await runAdsOptimization({
      trigger: "manual",
      dryRun: true,
      ignoreCooldown: false,
    });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
