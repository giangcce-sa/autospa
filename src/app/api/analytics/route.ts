import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

type Analytics = { likes: number; comments: number; shares: number };
type PostWithAnalytics = { id: string; caption: string; analytics: Analytics | null };

export async function GET() {
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
