import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const days = Number(searchParams.get("days") ?? 30);
    const since = new Date(Date.now() - days * 86400000);

    // Pull all booking revenue in window
    const revenues = await prisma.bookingRevenue.findMany({
      where: { paidAt: { gte: since } },
      orderBy: { paidAt: "desc" },
    });

    // Group by post
    const byPost = new Map<string, { count: number; total: number; leadIds: Set<string> }>();
    const byCampaign = new Map<string, { count: number; total: number; leadIds: Set<string> }>();
    let unattributed = 0;
    let unattributedAmount = 0;
    let totalRevenue = 0;

    for (const r of revenues) {
      totalRevenue += r.amount;
      if (r.fromPostId) {
        const cur = byPost.get(r.fromPostId) ?? { count: 0, total: 0, leadIds: new Set() };
        cur.count++;
        cur.total += r.amount;
        if (r.leadId) cur.leadIds.add(r.leadId);
        byPost.set(r.fromPostId, cur);
      }
      if (r.fromCampaignId) {
        const cur = byCampaign.get(r.fromCampaignId) ?? { count: 0, total: 0, leadIds: new Set() };
        cur.count++;
        cur.total += r.amount;
        if (r.leadId) cur.leadIds.add(r.leadId);
        byCampaign.set(r.fromCampaignId, cur);
      }
      if (!r.fromPostId && !r.fromCampaignId) {
        unattributed++;
        unattributedAmount += r.amount;
      }
    }

    // Enrich post group with caption
    const postIds = Array.from(byPost.keys());
    const posts = postIds.length
      ? await prisma.post.findMany({
          where: { id: { in: postIds } },
          select: { id: true, caption: true, platform: true, publishedAt: true, status: true },
        })
      : [];
    const postMap = new Map(posts.map((p) => [p.id, p]));

    const topPosts = Array.from(byPost.entries())
      .map(([postId, v]) => ({
        postId,
        caption: postMap.get(postId)?.caption ?? "(bài đã xóa)",
        platform: postMap.get(postId)?.platform,
        publishedAt: postMap.get(postId)?.publishedAt,
        bookings: v.count,
        leads: v.leadIds.size,
        revenue: v.total,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Enrich campaign group with optimization logs (campaign name)
    const campaignIds = Array.from(byCampaign.keys());
    const logs = campaignIds.length
      ? await prisma.adOptimizationLog.findMany({
          where: { campaignId: { in: campaignIds } },
          orderBy: { createdAt: "desc" },
          distinct: ["campaignId"],
          select: { campaignId: true, campaignName: true },
        })
      : [];
    const logMap = new Map(logs.map((l) => [l.campaignId, l.campaignName]));

    const topCampaigns = Array.from(byCampaign.entries())
      .map(([campaignId, v]) => ({
        campaignId,
        campaignName: logMap.get(campaignId) ?? campaignId,
        bookings: v.count,
        leads: v.leadIds.size,
        revenue: v.total,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return NextResponse.json({
      data: {
        days,
        totalRevenue,
        totalBookings: revenues.length,
        unattributed,
        unattributedAmount,
        topPosts,
        topCampaigns,
      },
      success: true,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}
