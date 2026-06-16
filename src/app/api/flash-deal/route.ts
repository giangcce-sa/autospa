import { NextRequest, NextResponse } from "next/server";
import { detectSlotGaps, runFlashDealDetection, postFlashDeal } from "@/lib/flash-deal-engine";

export async function GET() {
  try {
    const gaps = await detectSlotGaps();
    return NextResponse.json({ success: true, data: { gaps } });
  } catch (e) {
    return NextResponse.json({ error: String(e), success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "detect") {
      const result = await runFlashDealDetection();
      return NextResponse.json({ success: true, data: result });
    }

    if (action === "post") {
      const { caption } = body;
      if (!caption) return NextResponse.json({ success: false, message: "Thiếu caption" });
      const result = await postFlashDeal(caption);
      return NextResponse.json({ success: true, data: result });
    }

    return NextResponse.json({ success: false, message: "Action không hợp lệ" });
  } catch (e) {
    return NextResponse.json({ error: String(e), success: false }, { status: 500 });
  }
}
