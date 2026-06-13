import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateContent } from "@/lib/claude";

export async function GET() {
  try {
    const [postCount, publishedCount, totalAnalytics, customers, leads, careMessages, comments] = await Promise.all([
      prisma.post.count(),
      prisma.post.count({ where: { status: "published" } }),
      prisma.postAnalytics.aggregate({ _sum: { reach: true, likes: true, comments: true, shares: true } }),
      prisma.customer.count(),
      prisma.lead.count(),
      prisma.careMessage.count({ where: { status: "sent" } }),
      prisma.postComment.count(),
    ]);

    const closedLeads = await prisma.lead.count({ where: { stage: "closed" } });
    const hotLeads = await prisma.lead.count({ where: { stage: "hot" } });

    const topPosts = await prisma.post.findMany({
      where: { analytics: { isNot: null } },
      include: { analytics: true },
      orderBy: { analytics: { likes: "desc" } },
      take: 5,
    });

    const bySource = await prisma.lead.groupBy({ by: ["source"], _count: true });
    const bySegment = await prisma.customer.groupBy({ by: ["segment"], _count: true });

    const totalReach = totalAnalytics._sum.reach || 0;
    const totalLikes = totalAnalytics._sum.likes || 0;
    const totalComments = totalAnalytics._sum.comments || 0;
    const totalShares = totalAnalytics._sum.shares || 0;
    const avgEngagement = totalReach > 0 ? Math.round(((totalLikes + totalComments + totalShares) / totalReach) * 100) : 0;
    const conversionRate = leads > 0 ? Math.round((closedLeads / leads) * 100) : 0;

    return NextResponse.json({
      data: {
        overview: { postCount, publishedCount, totalReach, totalLikes, totalComments, totalShares, avgEngagement },
        crm: { customers, leads, closedLeads, hotLeads, conversionRate, careMessages },
        engagement: { comments, conversionRate },
        topPosts,
        bySource,
        bySegment,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST() {
  try {
    const [postCount, publishedCount, analytics, customers, leads, closedLeads] = await Promise.all([
      prisma.post.count(),
      prisma.post.count({ where: { status: "published" } }),
      prisma.postAnalytics.aggregate({ _sum: { reach: true, likes: true, comments: true, shares: true } }),
      prisma.customer.count(),
      prisma.lead.count(),
      prisma.lead.count({ where: { stage: "closed" } }),
    ]);

    const summary = await generateContent(
      `Báo cáo hiệu quả marketing spa:\n- Tổng bài đăng: ${postCount}, đã đăng: ${publishedCount}\n- Tổng tiếp cận: ${analytics._sum.reach || 0}\n- Tổng likes: ${analytics._sum.likes || 0}, comment: ${analytics._sum.comments || 0}\n- Khách hàng CRM: ${customers}\n- Leads: ${leads}, đã chốt: ${closedLeads}\n\nViết nhận xét ngắn (3-4 câu) về hiệu quả tổng thể và đề xuất cải thiện cụ thể cho tháng tới. Thực tế, có số liệu cụ thể.`,
      "Bạn là chuyên gia phân tích marketing spa."
    );

    return NextResponse.json({ data: { summary } });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
