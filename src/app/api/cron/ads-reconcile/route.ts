import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { reconcileAdsCreateOperations } from "@/lib/facebook-ads";

export async function GET(req: NextRequest) {
  const denied = verifyCronAuth(req);
  if (denied) return denied;
  const results = await reconcileAdsCreateOperations();
  return NextResponse.json({
    success: results.every((result) => result.status === "completed"),
    processed: results.length,
    data: results,
  });
}
