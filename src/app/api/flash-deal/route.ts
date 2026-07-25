import { NextRequest, NextResponse } from "next/server";
import { detectSlotGaps, runFlashDealDetection } from "@/lib/flash-deal-engine";
import { accessErrorResponse, requireUser } from "@/lib/page-access";

export async function GET() {
  try {
    await requireUser();
    const gaps = await detectSlotGaps();
    return NextResponse.json({ success: true, data: { gaps } });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return NextResponse.json({ error: String(error), success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireUser({ owner: true });
    const body = await req.json();
    if (body.action === "detect") {
      const result = await runFlashDealDetection();
      return NextResponse.json({ success: true, data: result });
    }

    return NextResponse.json({
      success: false,
      message: "Flash Deal chỉ tạo đề xuất; hãy persist draft theo Page và phân phối qua canonical Publishing",
    }, { status: 400 });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return NextResponse.json({ error: String(error), success: false }, { status: 500 });
  }
}
