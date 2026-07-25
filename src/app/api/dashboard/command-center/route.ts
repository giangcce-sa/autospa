import { accessErrorResponse, requirePageAccess } from "@/lib/page-access";
import { getTodayData } from "@/lib/today";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const facebookPageId = req.nextUrl.searchParams.get("facebookPageId");
    const { user } = await requirePageAccess(facebookPageId);
    const data = await getTodayData({
      scope: facebookPageId ? "current" : "account",
      pageIds: facebookPageId ? [facebookPageId] : null,
      includeGlobal: !facebookPageId && user.role === "owner",
      canMutate: user.role === "owner",
    });
    return NextResponse.json({ data, success: true });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    const message = error instanceof Error ? error.message : "Lỗi khi tải command center";
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}
