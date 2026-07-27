import { requirePageAccess } from "@/lib/page-access";
import { routeErrorResponse } from "@/lib/api-response";
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
    return routeErrorResponse(error, "Lỗi khi tải command center");
  }
}
