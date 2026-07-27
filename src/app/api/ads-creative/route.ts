import { generateAdCreative } from "@/lib/ads-creative";
import { accessErrorResponse, requireUser } from "@/lib/page-access";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    // Burns AI quota to build an ad spec — owner only
    await requireUser({ owner: true });
    const body = await req.json();
    const spec = await generateAdCreative({
      serviceId: body.serviceId,
      dailyBudget: body.dailyBudget,
      objective: body.objective,
      notes: body.notes,
    });
    return NextResponse.json({ data: spec, success: true });
  } catch (err) {
    const access = accessErrorResponse(err);
    if (access) return access;
    console.error("ads-creative failed:", err);
    return NextResponse.json({ error: "Không tạo được creative", success: false }, { status: 500 });
  }
}
