import { generateAdCreative } from "@/lib/ads-creative";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const spec = await generateAdCreative({
      serviceId: body.serviceId,
      dailyBudget: body.dailyBudget,
      objective: body.objective,
      notes: body.notes,
    });
    return NextResponse.json({ data: spec, success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}
