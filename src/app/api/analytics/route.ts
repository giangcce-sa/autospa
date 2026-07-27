import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getIntelligencePerformance } from "@/lib/growth-intelligence";
import {
  AccessError,
  accessErrorResponse,
  getAuthorizedPageIds,
  requireExplicitPageAccess,
  requireUser,
} from "@/lib/page-access";
import { routeErrorResponse } from "@/lib/api-response";
import { businessDateKey, businessHour } from "@/lib/today-policy";

async function resolveAnalyticsScope(req: NextRequest, owner = false) {
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
    const action = new URL(req.url).searchParams.get("action");
    const { pageIds, scope } = await resolveAnalyticsScope(req);
    const pageFilter = { facebookPageId: { in: pageIds } };

    if (action === "trend") {
      const days = 30;
      const since = new Date(Date.now() - days * 86_400_000);
      const posts = await prisma.post.findMany({
        where: { ...pageFilter, status: "published", publishedAt: { gte: since } },
        select: { publishedAt: true, analytics: { select: { likes: true, comments: true, shares: true, reach: true } } },
        orderBy: { publishedAt: "asc" },
      });
      const byDay: Record<string, { engagement: number; reach: number; posts: number; measured: number }> = {};
      for (let index = 0; index < days; index++) {
        byDay[businessDateKey(new Date(Date.now() - (days - 1 - index) * 86_400_000))] = { engagement: 0, reach: 0, posts: 0, measured: 0 };
      }
      for (const post of posts) {
        if (!post.publishedAt) continue;
        const day = byDay[businessDateKey(post.publishedAt)];
        if (!day) continue;
        day.posts += 1;
        if (post.analytics) {
          day.measured += 1;
          day.engagement += post.analytics.likes + post.analytics.comments * 2 + post.analytics.shares * 3;
          day.reach += post.analytics.reach;
        }
      }
      const trend = Object.entries(byDay).map(([date, value]) => ({
        date,
        label: new Date(`${date}T00:00:00+07:00`).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }),
        engagement: value.measured ? value.engagement : null,
        reach: value.measured ? value.reach : null,
        posts: value.posts,
        measured: value.measured,
        engagementRate: value.reach > 0 ? Math.round((value.engagement / value.reach) * 10_000) / 100 : null,
      }));
      return NextResponse.json({ data: { trend, provenance: { scope, source: "Post + PostAnalytics", window: "30 ngày", asOf: new Date().toISOString() } }, success: true });
    }

    if (action === "leads") {
      throw new AccessError("Lead chưa có Page ownership nhất quán; không thể ghép vào analytics theo Page", 409);
    }

    if (action === "best-times") {
      const posts = await prisma.post.findMany({
        where: { ...pageFilter, status: "published", publishedAt: { not: null }, analytics: { isNot: null } },
        select: { publishedAt: true, analytics: { select: { likes: true, comments: true, shares: true } } },
        orderBy: { publishedAt: "desc" },
        take: 100,
      });
      const byHour: Record<number, { count: number; engagement: number }> = {};
      for (const post of posts) {
        if (!post.publishedAt || !post.analytics) continue;
        const hour = businessHour(post.publishedAt);
        const engagement = post.analytics.likes + post.analytics.comments * 2 + post.analytics.shares * 3;
        byHour[hour] ??= { count: 0, engagement: 0 };
        byHour[hour].count += 1;
        byHour[hour].engagement += engagement;
      }
      const topHours = Object.entries(byHour)
        .map(([hour, value]) => ({ hour: Number(hour), avgEngagement: Math.round(value.engagement / value.count), posts: value.count }))
        .sort((a, b) => b.avgEngagement - a.avgEngagement)
        .slice(0, 5);
      return NextResponse.json({
        data: {
          topHours,
          suggestion: topHours[0]?.hour ?? null,
          message: topHours.length >= 1
            ? `Trong dữ liệu hiện có, ${topHours[0].hour}:00 có engagement trung bình cao nhất; cần xét số mẫu trước khi quyết định.`
            : "Chưa có Post đã published kèm analytics trong phạm vi.",
          provenance: { scope, source: "Post.publishedAt + PostAnalytics", window: "100 Post measured gần nhất", asOf: new Date().toISOString(), timeZone: "Asia/Ho_Chi_Minh" },
        },
        success: true,
      });
    }

    if (action === "platform-breakdown") {
      const posts = await prisma.post.findMany({
        where: { ...pageFilter, status: "published", analytics: { isNot: null } },
        select: {
          caption: true,
          igPostId: true,
          tiktokVideoId: true,
          analytics: true,
        },
        orderBy: { publishedAt: "desc" },
        take: 500,
      });
      const platforms: Record<string, { reach: number; engagement: number; count: number; topEngagement: number; topCaption: string }> = {};
      const add = (platform: string, reach: number, engagement: number, caption: string) => {
        const current = platforms[platform] ?? { reach: 0, engagement: 0, count: 0, topEngagement: 0, topCaption: "" };
        current.reach += reach;
        current.engagement += engagement;
        current.count += 1;
        if (engagement > current.topEngagement) {
          current.topEngagement = engagement;
          current.topCaption = caption;
        }
        platforms[platform] = current;
      };
      for (const post of posts) {
        if (!post.analytics) continue;
        add("facebook", post.analytics.reach, post.analytics.likes + post.analytics.comments * 2 + post.analytics.shares * 3, post.caption);
        if (post.igPostId) add("instagram", post.analytics.igReach, post.analytics.igLikes + post.analytics.igComments * 2 + post.analytics.igSaved * 1.5, post.caption);
        if (post.tiktokVideoId) add("tiktok", post.analytics.tiktokViews, post.analytics.tiktokLikes + post.analytics.tiktokComments * 2 + post.analytics.tiktokShares * 3, post.caption);
      }
      const breakdown = Object.entries(platforms).map(([platform, value]) => ({
        platform,
        postCount: value.count,
        totalReach: value.reach,
        totalEngagement: Math.round(value.engagement),
        avgEngagement: value.count ? Math.round(value.engagement / value.count) : null,
        topPost: value.topEngagement ? { caption: value.topCaption, engagement: Math.round(value.topEngagement) } : null,
      }));
      return NextResponse.json({ data: breakdown, provenance: { scope, source: "Post channel IDs + PostAnalytics", window: "500 Post measured gần nhất", asOf: new Date().toISOString() }, success: true });
    }

    const performance = await getIntelligencePerformance(pageIds, scope);
    return NextResponse.json({
      data: {
        posts: performance.recentPosts,
        topPosts: performance.topPosts,
        totalReach: performance.totals.reach,
        totalLikes: performance.totals.likes,
        totalComments: performance.totals.comments,
        totalShares: performance.totals.shares,
        avgEngagement: performance.totals.engagementRate,
        provenance: performance.provenance,
      },
      success: true,
    });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return routeErrorResponse(error, "Lỗi khi tải");
  }
}

export async function POST(req: NextRequest) {
  try {
    const { postId, reach, likes, comments, shares, clicks } = await req.json();
    if (typeof postId !== "string" || !postId.trim()) throw new AccessError("Thiếu Post ID", 400);
    const metrics = { reach, likes, comments, shares, clicks };
    for (const [name, value] of Object.entries(metrics)) {
      if (value != null && (!Number.isSafeInteger(value) || value < 0)) {
        throw new AccessError(`${name} phải là số nguyên không âm`, 400);
      }
    }

    const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true, facebookPageId: true } });
    if (!post) throw new AccessError("Không tìm thấy Post", 404);
    if (!post.facebookPageId) throw new AccessError("Post chưa có Facebook Page ownership", 409);
    await requireExplicitPageAccess(post.facebookPageId, { owner: true });

    const analytics = await prisma.postAnalytics.upsert({
      where: { postId: post.id },
      create: { postId: post.id, reach: reach ?? 0, likes: likes ?? 0, comments: comments ?? 0, shares: shares ?? 0, clicks: clicks ?? 0 },
      update: { reach: reach ?? 0, likes: likes ?? 0, comments: comments ?? 0, shares: shares ?? 0, clicks: clicks ?? 0, fetchedAt: new Date() },
      select: { postId: true, reach: true, likes: true, comments: true, shares: true, clicks: true, fetchedAt: true },
    });
    return NextResponse.json({ data: { ...analytics, fetchedAt: analytics.fetchedAt.toISOString() }, success: true });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return routeErrorResponse(error, "Lỗi không xác định");
  }
}
