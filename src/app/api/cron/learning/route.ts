import { NextRequest, NextResponse } from "next/server";
import { runAllLearningLoops } from "@/lib/learning";
import { verifyCronAuth } from "@/lib/cron-auth";

// Cron: runs nightly at 02:00 (low-traffic hour)
export async function GET(req: NextRequest) {
  const denied = verifyCronAuth(req);
  if (denied) return denied;

  try {
    const result = await runAllLearningLoops();
    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    return NextResponse.json({ error: String(e), success: false }, { status: 500 });
  }
}
