import { prisma } from "./db";

interface RawFbPost {
  id: string;
  message?: string;
  created_time: string;
  likes?: { summary: { total_count: number } };
  comments?: { summary: { total_count: number } };
  shares?: { count: number };
}

/**
 * Fetch recent posts of a public Facebook Page.
 * Tries competitor's own token first, falls back to active page token.
 */
async function fetchPublicPagePosts(fbPageId: string, accessToken: string, limit = 15): Promise<RawFbPost[]> {
  const fields = "id,message,created_time,likes.summary(true),comments.summary(true),shares";
  const url = `https://graph.facebook.com/v21.0/${fbPageId}/posts?fields=${fields}&limit=${limit}&access_token=${accessToken}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return (data.data ?? []) as RawFbPost[];
}

/**
 * Sync one competitor: fetch their recent posts, upsert into CompetitorPost.
 * Returns number of new posts added.
 */
export async function syncOneCompetitor(competitorId: string): Promise<{ added: number; total: number }> {
  const competitor = await prisma.competitor.findUnique({ where: { id: competitorId } });
  if (!competitor) throw new Error("Không tìm thấy đối thủ");
  if (!competitor.isActive) return { added: 0, total: 0 };

  // Pick token: competitor's own → first active page's token
  let token = competitor.accessToken;
  if (!token) {
    const ownPage = await prisma.facebookPage.findFirst({ where: { isActive: true } });
    token = ownPage?.accessToken ?? null;
  }
  if (!token) throw new Error("Cần access token (cấu hình Facebook Page hoặc nhập token cho đối thủ)");

  const posts = await fetchPublicPagePosts(competitor.fbPageId, token);

  let added = 0;
  for (const p of posts) {
    if (!p.message || p.message.length < 20) continue;
    const exists = await prisma.competitorPost.findUnique({ where: { fbPostId: p.id } });
    if (exists) continue;
    await prisma.competitorPost.create({
      data: {
        competitorId: competitor.id,
        fbPostId: p.id,
        message: p.message,
        likes: p.likes?.summary?.total_count ?? 0,
        comments: p.comments?.summary?.total_count ?? 0,
        shares: p.shares?.count ?? 0,
        publishedAt: new Date(p.created_time),
      },
    });
    added++;
  }

  await prisma.competitor.update({
    where: { id: competitor.id },
    data: { lastFetchAt: new Date() },
  });

  return { added, total: posts.length };
}

/**
 * Sync all active competitors. Called from cron.
 */
export async function syncCompetitors(): Promise<{ syncedCount: number; addedCount: number; errors: string[] }> {
  const competitors = await prisma.competitor.findMany({ where: { isActive: true } });
  let addedCount = 0;
  let syncedCount = 0;
  const errors: string[] = [];

  for (const c of competitors) {
    try {
      const r = await syncOneCompetitor(c.id);
      addedCount += r.added;
      syncedCount++;
    } catch (e) {
      errors.push(`${c.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { syncedCount, addedCount, errors };
}

/**
 * Get top competitor posts in the last N days, sorted by engagement.
 * Returns at most `limit` posts. Used as context for content research.
 */
export async function getTopCompetitorPosts(days = 7, limit = 5) {
  const since = new Date(Date.now() - days * 86400000);
  const posts = await prisma.competitorPost.findMany({
    where: { publishedAt: { gte: since } },
    include: { competitor: { select: { name: true } } },
    orderBy: { publishedAt: "desc" },
  });

  // Score by engagement (weighted)
  return posts
    .map((p) => ({
      ...p,
      score: p.likes + p.comments * 2 + p.shares * 3,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
