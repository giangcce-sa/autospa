import { NextRequest, NextResponse } from "next/server";
import { detectSlotGaps, runFlashDealDetection } from "@/lib/flash-deal-engine";
import { requireUser } from "@/lib/page-access";
import { routeErrorResponse } from "@/lib/api-response";

export async function GET() {
  try {
    await requireUser();
    const gaps = await detectSlotGaps();
    return NextResponse.json({ success: true, data: { gaps } });
  } catch (error) {
    return routeErrorResponse(error, "Lỗi khi tải");
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
    return routeErrorResponse(error, "Lỗi không xác định");
  }
}
