import { NextResponse } from "next/server";
import { runAllLearningLoops } from "@/lib/learning";

// Cron: runs nightly at 02:00 (low-traffic hour)
export async function GET() {
  try {
    const result = await runAllLearningLoops();
    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    return NextResponse.json({ error: String(e), success: false }, { status: 500 });
  }
}
