import { getAllQuotas } from "@/lib/rate-limiter";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const quotas = await getAllQuotas();
    return NextResponse.json({ data: quotas, success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}
