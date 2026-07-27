import "server-only";

import { prisma } from "@/lib/db";
import { fetchIgInsights } from "@/lib/instagram";
import { decryptSecret } from "@/lib/secrets-crypto";
import { fetchTikTokVideoStats } from "@/lib/tiktok";

export async function syncPublishedVideoPerformance(limit = 25) {
  const projects = await prisma.videoProject.findMany({
    where: { status: "published", publishedPostId: { not: null } },
    orderBy: { updatedAt: "desc" }, take: limit,
  });
  const postIds = projects.map((project) => project.publishedPostId).filter((id): id is string => Boolean(id));
  const posts = await prisma.post.findMany({ where: { id: { in: postIds } } });
  const postMap = new Map(posts.map((post) => [post.id, post]));
  const tiktok = await prisma.tikTokAccount.findFirst({ where: { isActive: true } });
  const results: Array<{ projectId: string; platform: string; status: "synced" | "skipped" | "failed"; error?: string }> = [];

  for (const project of projects) {
    const post = project.publishedPostId ? postMap.get(project.publishedPostId) : null;
    if (!post) continue;
    if (post.igPostId && project.facebookPageId) {
      try {
        const page = await prisma.facebookPage.findUnique({ where: { id: project.facebookPageId } });
        const igToken = decryptSecret(page?.accessToken);
        if (!page || !igToken) throw new Error("Không tìm thấy Facebook Page chứa Instagram token");
        const stats = await fetchIgInsights(post.igPostId, igToken);
        await prisma.videoPerformance.create({ data: {
          projectId: project.id, platform: "instagram", externalPostId: post.igPostId,
          views: stats.impressions, impressions: stats.impressions,
        } });
        results.push({ projectId: project.id, platform: "instagram", status: "synced" });
      } catch (error) {
        results.push({ projectId: project.id, platform: "instagram", status: "failed", error: error instanceof Error ? error.message : String(error) });
      }
    }
    if (post.tiktokVideoId && tiktok) {
      try {
        const tiktokToken = decryptSecret(tiktok.accessToken);
        if (!tiktokToken) throw new Error("Access Token TikTok không đọc được");
        const stats = await fetchTikTokVideoStats(tiktokToken, post.tiktokVideoId);
        await prisma.videoPerformance.create({ data: {
          projectId: project.id, platform: "tiktok", externalPostId: post.tiktokVideoId, views: stats.views,
        } });
        results.push({ projectId: project.id, platform: "tiktok", status: "synced" });
      } catch (error) {
        results.push({ projectId: project.id, platform: "tiktok", status: "failed", error: error instanceof Error ? error.message : String(error) });
      }
    }
    if (post.fbPostId) results.push({ projectId: project.id, platform: "facebook", status: "skipped" });
  }
  return results;
}
