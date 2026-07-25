import { NextRequest, NextResponse } from "next/server";
import { generateContent } from "@/lib/claude";
import { prisma } from "@/lib/db";
import { getIntelligencePerformance } from "@/lib/growth-intelligence";
import {
  AccessError,
  accessErrorResponse,
  getAuthorizedPageIds,
  requireExplicitPageAccess,
  requireUser,
} from "@/lib/page-access";

async function resolveReportScope(req: NextRequest, owner = false) {
  const user = await requireUser({ owner });
  const requestedPageId = new URL(req.url).searchParams.get("facebookPageId");
  if (requestedPageId) {
    await requireExplicitPageAccess(requestedPageId, { owner });
    return { pageIds: [requestedPageId], scope: "current" as const };
  }

  const authorizedPageIds = await getAuthorizedPageIds(user);
  const pageIds = authorizedPageIds ?? (await prisma.facebookPage.findMany({ select: { id: true } })).map((page) => page.id);
  return { pageIds, scope: "all" as const };
}

export async function GET(req: NextRequest) {
  try {
    const { pageIds, scope } = await resolveReportScope(req);
    const performance = await getIntelligencePerformance(pageIds, scope);

    return NextResponse.json({
      data: {
        overview: {
          postCount: performance.totals.posts,
          publishedCount: performance.totals.published,
          totalReach: performance.totals.reach,
          totalLikes: performance.totals.likes,
          totalComments: performance.totals.comments,
          totalShares: performance.totals.shares,
          avgEngagement: performance.totals.engagementRate,
        },
        topPosts: performance.topPosts,
        provenance: performance.provenance,
        crm: null,
        engagement: null,
        bySource: [],
        bySegment: [],
      },
      success: true,
    });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return NextResponse.json({ error: String(error), success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { pageIds, scope } = await resolveReportScope(req, true);
    const performance = await getIntelligencePerformance(pageIds, scope);
    if (performance.provenance.availability === "unavailable") {
      throw new AccessError("Chưa có analytics khả dụng để tạo nhận xét", 409);
    }

    const summary = await generateContent(
      `Báo cáo hiệu quả nội dung theo Facebook Page được phép:\n- Tổng Post persisted: ${performance.totals.posts}\n- Đã published: ${performance.totals.published}\n- Có analytics: ${performance.totals.measured}\n- Tổng tiếp cận: ${performance.totals.reach}\n- Tổng likes: ${performance.totals.likes}, comment: ${performance.totals.comments}, share: ${performance.totals.shares}\n- Tỷ lệ tương tác: ${performance.totals.engagementRate}%\n- Độ đầy đủ: ${performance.provenance.completeness == null ? "chưa xác định" : `${Math.round(performance.provenance.completeness * 100)}%`}\n\nViết nhận xét ngắn 3-4 câu. Nêu rõ hạn chế nếu dữ liệu chưa đầy đủ và không suy luận doanh thu, lead hoặc attribution.`,
      "Bạn là chuyên gia phân tích content marketing spa. Chỉ kết luận từ số liệu được cung cấp.",
    );

    return NextResponse.json({ data: { summary, provenance: performance.provenance }, success: true });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return NextResponse.json({ error: String(error), success: false }, { status: 500 });
  }
}
