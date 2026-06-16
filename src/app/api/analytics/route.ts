import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

type Analytics = { likes: number; comments: number; shares: number };
type PostWithAnalytics = { id: string; caption: string; analytics: Analytics | null };

export async function GET(req: NextRequest) {
  const action = new URL(req.url).searchParams.get("action");

  if (action === "trend") {
    try {
      const days = 30;
      const since = new Date(Date.now() - days * 86400000);
      const posts = await prisma.post.findMany({
        where: { status: "published", publishedAt: { gte: since } },
        include: { analytics: true },
        orderBy: { publishedAt: "asc" },
      });

      const byDay: Record<string, { engagement: number; reach: number; posts: number }> = {};
      for (let i = 0; i < days; i++) {
        const d = new Date(Date.now() - (days - 1 - i) * 86400000);
        const key = d.toISOString().slice(0, 10);
        byDay[key] = { engagement: 0, reach: 0, posts: 0 };
      }
      for (const post of posts) {
        if (!post.publishedAt) continue;
        const key = new Date(post.publishedAt).toISOString().slice(0, 10);
        if (!byDay[key]) continue;
        byDay[key].posts++;
        if (post.analytics) {
          byDay[key].engagement += (post.analytics.likes ?? 0) + (post.analytics.comments ?? 0) * 2 + (post.analytics.shares ?? 0) * 3;
          byDay[key].reach += post.analytics.reach ?? 0;
        }
      }

      const trend = Object.entries(byDay).map(([date, v]) => ({
        date,
        label: new Date(date).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }),
        engagement: v.engagement,
        reach: v.reach,
        posts: v.posts,
        ctr: v.reach > 0 ? Math.round((v.engagement / v.reach) * 100) : 0,
      }));

      return NextResponse.json({ data: { trend }, success: true });
    } catch {
      return NextResponse.json({ error: "Lỗi khi tính trend", success: false }, { status: 500 });
    }
  }

  if (action === "leads") {
    try {
      const [total, cold, warm, hot, closed] = await Promise.all([
        prisma.lead.count(),
        prisma.lead.count({ where: { stage: "cold" } }),
        prisma.lead.count({ where: { stage: "warm" } }),
        prisma.lead.count({ where: { stage: "hot" } }),
        prisma.lead.count({ where: { stage: "closed" } }),
      ]);
      const bySource = await prisma.lead.groupBy({ by: ["source"], _count: { id: true } });
      const convRate = total > 0 ? Math.round((closed / total) * 100) : 0;
      return NextResponse.json({
        data: { total, cold, warm, hot, closed, convRate, bySource: bySource.map(r => ({ source: r.source, count: r._count.id })) },
        success: true,
      });
    } catch {
      return NextResponse.json({ error: "Lỗi khi tải lead stats", success: false }, { status: 500 });
    }
  }

  if (action === "best-times") {
    try {
      const posts = await prisma.post.findMany({
        where: { status: "published", publishedAt: { not: null } },
        include: { analytics: true },
        take: 100,
      });

      // Group by hour of day, accumulate engagement
      const byHour: Record<number, { count: number; engagement: number }> = {};
      for (const post of posts) {
        if (!post.publishedAt || !post.analytics) continue;
        const h = new Date(post.publishedAt).getHours();
        const eng = (post.analytics.likes ?? 0) + (post.analytics.comments ?? 0) * 2 + (post.analytics.shares ?? 0) * 3;
        if (!byHour[h]) byHour[h] = { count: 0, engagement: 0 };
        byHour[h].count++;
        byHour[h].engagement += eng;
      }

      const ranked = Object.entries(byHour)
        .map(([h, v]) => ({ hour: Number(h), avgEngagement: v.count ? Math.round(v.engagement / v.count) : 0, posts: v.count }))
        .sort((a, b) => b.avgEngagement - a.avgEngagement)
        .slice(0, 5);

      const hasData = ranked.length > 0;
      return NextResponse.json({
        data: {
          topHours: ranked,
          suggestion: hasData ? ranked[0].hour : null,
          message: hasData
            ? `Bài đăng lúc ${ranked[0].hour}:00 thường có engagement cao nhất (trung bình ${ranked[0].avgEngagement} điểm)`
            : "Chưa đủ dữ liệu — cần ít nhất 5 bài đã đăng có analytics",
        },
        success: true,
      });
    } catch {
      return NextResponse.json({ error: "Lỗi khi phân tích", success: false }, { status: 500 });
    }
  }

  try {
    const [posts, analytics] = await Promise.all([
      prisma.post.findMany({
        where: { OR: [{ status: "published" }, { analytics: { isNot: null } }] },
        include: { analytics: true },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.postAnalytics.findMany({ orderBy: { fetchedAt: "desc" } }),
    ]);

    const totalReach = analytics.reduce((s: number, a: { reach: number }) => s + a.reach, 0);
    const totalLikes = analytics.reduce((s: number, a: { likes: number }) => s + a.likes, 0);
    const totalComments = analytics.reduce((s: number, a: { comments: number }) => s + a.comments, 0);
    const totalShares = analytics.reduce((s: number, a: { shares: number }) => s + a.shares, 0);
    const avgEngagement = analytics.length
      ? Math.round(((totalLikes + totalComments + totalShares) / Math.max(totalReach, 1)) * 100)
      : 0;

    const topPosts = (posts as PostWithAnalytics[])
      .filter((p) => p.analytics)
      .sort((a, b) => {
        const scoreA = (a.analytics?.likes ?? 0) + (a.analytics?.comments ?? 0) * 2 + (a.analytics?.shares ?? 0) * 3;
        const scoreB = (b.analytics?.likes ?? 0) + (b.analytics?.comments ?? 0) * 2 + (b.analytics?.shares ?? 0) * 3;
        return scoreB - scoreA;
      })
      .slice(0, 5);

    return NextResponse.json({
      data: { posts, totalReach, totalLikes, totalComments, totalShares, avgEngagement, topPosts },
      success: true,
    });
  } catch {
    return NextResponse.json({ error: "Lỗi khi tải", success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { postId, reach, likes, comments, shares, clicks } = await req.json();
    const analytics = await prisma.postAnalytics.upsert({
      where: { postId },
      create: { postId, reach: reach ?? 0, likes: likes ?? 0, comments: comments ?? 0, shares: shares ?? 0, clicks: clicks ?? 0 },
      update: { reach: reach ?? 0, likes: likes ?? 0, comments: comments ?? 0, shares: shares ?? 0, clicks: clicks ?? 0, fetchedAt: new Date() },
    });
    return NextResponse.json({ data: analytics, success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}
