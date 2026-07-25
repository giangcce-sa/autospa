import { accessErrorResponse, requireUser } from "@/lib/page-access";
import { getAllQuotas } from "@/lib/rate-limiter";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await requireUser({ owner: true });
    const quotas = await getAllQuotas();
    return NextResponse.json({ data: quotas, success: true });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return NextResponse.json({ error: "Không thể đọc quota", success: false }, { status: 500 });
  }
}
