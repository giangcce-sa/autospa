import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { reconcileExpiredPublishOperations } from "@/lib/publishing/service";

export async function GET(req: NextRequest) {
  const denied = verifyCronAuth(req);
  if (denied) return denied;

  try {
    return NextResponse.json({ success: true, data: await reconcileExpiredPublishOperations() });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
