import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/page-access";
import { routeErrorResponse } from "@/lib/api-response";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const daysSchema = z.enum(["7", "30", "90"]).transform(Number);

export async function GET(req: NextRequest) {
  try {
    await requireUser({ owner: true });
    const days = daysSchema.parse(new URL(req.url).searchParams.get("days") ?? "30");
    const since = new Date(Date.now() - days * 86400000);
    const revenues = await prisma.bookingRevenue.findMany({
      where: { paidAt: { gte: since } },
      orderBy: { paidAt: "desc" },
    });

    const byPost = new Map<string, { count: number; total: number; leadIds: Set<string> }>();
    const byCampaign = new Map<string, { count: number; total: number; leadIds: Set<string> }>();
    let unattributed = 0;
    let unattributedAmount = 0;
    let totalRevenue = 0;

    for (const revenue of revenues) {
      totalRevenue += revenue.amount;
      if (revenue.fromPostId) {
        const current = byPost.get(revenue.fromPostId) ?? { count: 0, total: 0, leadIds: new Set<string>() };
        current.count++;
        current.total += revenue.amount;
        if (revenue.leadId) current.leadIds.add(revenue.leadId);
        byPost.set(revenue.fromPostId, current);
      }
      if (revenue.fromCampaignId) {
        const current = byCampaign.get(revenue.fromCampaignId) ?? { count: 0, total: 0, leadIds: new Set<string>() };
        current.count++;
        current.total += revenue.amount;
        if (revenue.leadId) current.leadIds.add(revenue.leadId);
        byCampaign.set(revenue.fromCampaignId, current);
      }
      if (!revenue.fromPostId && !revenue.fromCampaignId) {
        unattributed++;
        unattributedAmount += revenue.amount;
      }
    }

    const postIds = Array.from(byPost.keys());
    const campaignIds = Array.from(byCampaign.keys());
    const [posts, logs] = await Promise.all([
      postIds.length
        ? prisma.post.findMany({
            where: { id: { in: postIds } },
            select: { id: true, caption: true, platform: true, publishedAt: true },
          })
        : [],
      campaignIds.length
        ? prisma.adOptimizationLog.findMany({
            where: { campaignId: { in: campaignIds } },
            orderBy: { createdAt: "desc" },
            distinct: ["campaignId"],
            select: { campaignId: true, campaignName: true },
          })
        : [],
    ]);
    const postMap = new Map(posts.map((post) => [post.id, post]));
    const logMap = new Map(logs.map((log) => [log.campaignId, log.campaignName]));
    const topPosts = Array.from(byPost.entries())
      .map(([postId, value]) => ({
        postId,
        caption: postMap.get(postId)?.caption ?? "(bài đã xóa)",
        platform: postMap.get(postId)?.platform,
        publishedAt: postMap.get(postId)?.publishedAt,
        bookings: value.count,
        leads: value.leadIds.size,
        revenue: value.total,
      }))
      .sort((left, right) => right.revenue - left.revenue)
      .slice(0, 10);
    const topCampaigns = Array.from(byCampaign.entries())
      .map(([campaignId, value]) => ({
        campaignId,
        campaignName: logMap.get(campaignId) ?? campaignId,
        bookings: value.count,
        leads: value.leadIds.size,
        revenue: value.total,
      }))
      .sort((left, right) => right.revenue - left.revenue)
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
        provenance: { scope: "account", source: "BookingRevenue", windowDays: days },
      },
      success: true,
    });
  } catch (error) {
    return routeErrorResponse(error, "Lỗi");
  }
}
