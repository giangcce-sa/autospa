import { getImageHistoryPage } from "@/lib/image-history";
import { requirePageAccess } from "@/lib/page-access";
import { routeErrorResponse } from "@/lib/api-response";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const params = new URL(req.url).searchParams;
    const facebookPageId = params.get("facebookPageId") || null;
    await requirePageAccess(facebookPageId);
    const take = Math.min(Math.max(Number(params.get("take")) || 24, 1), 60);
    const page = await getImageHistoryPage(facebookPageId, {
      take,
      cursor: params.get("cursor"),
      staffProfileId: params.get("staffProfileId"),
    });
    return NextResponse.json({
      success: true,
      data: page.items,
      pagination: { nextCursor: page.nextCursor },
    });
  } catch (error) {
    return routeErrorResponse(error, "Lỗi khi tải");
  }
}
