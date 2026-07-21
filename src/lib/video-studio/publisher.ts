import "server-only";

import { prisma } from "@/lib/db";
import { postVideoToFacebook } from "@/lib/facebook";
import { postVideoToInstagram } from "@/lib/instagram";
import { signedMediaUrl, storageKeyFromMediaUrl } from "@/lib/media-storage";
import { postVideoToTikTok } from "@/lib/tiktok";
import { assertProjectPublishConsent } from "./consent";

export type VideoPublishTarget = "facebook" | "instagram" | "tiktok";

export async function publishVideoProject(input: { projectId: string; targets: VideoPublishTarget[]; force?: boolean; revision: number }) {
  const project = await prisma.videoProject.findUnique({ where: { id: input.projectId } });
  if (!project) throw new Error("Không tìm thấy dự án");
  if (project.inputRevision !== input.revision || project.renderedRevision !== input.revision || project.approvedRevision !== input.revision) {
    throw new Error("Dự án đã thay đổi sau khi lệnh publish được tạo");
  }
  if (project.approvalStatus !== "approved" || !project.outputUrl || (project.qualityScore || 0) < 75) {
    throw new Error("Video phải được render, vượt QA và duyệt trước khi đăng");
  }
  if (project.outputUrl.startsWith("mock://")) throw new Error("Không thể đăng output mock");
  await assertProjectPublishConsent(project.id);

  const text = `${project.caption || project.name}\n\n${project.hashtags || ""}`.trim();
  const results: Record<string, string> = {};
  const page = project.facebookPageId ? await prisma.facebookPage.findUnique({ where: { id: project.facebookPageId } }) : null;
  const storageKey = project.outputStorageKey || storageKeyFromMediaUrl(project.outputUrl);
  const publicUrl = storageKey ? signedMediaUrl(storageKey, 3600) : project.outputUrl;
  for (const target of input.targets) {
    try {
      if (target === "facebook") results.facebook = await postVideoToFacebook(text, project.outputUrl, project.facebookPageId || undefined);
      if (target === "instagram") {
        if (!page?.igAccountId) throw new Error("Chưa kết nối Instagram Business");
        results.instagram = await postVideoToInstagram(page.igAccountId, page.accessToken, text, publicUrl);
      }
      if (target === "tiktok") {
        const account = await prisma.tikTokAccount.findFirst({ where: { isActive: true } });
        if (!account) throw new Error("Chưa kết nối TikTok");
        results.tiktok = (await postVideoToTikTok(account.accessToken, text, publicUrl)).publishId;
      }
    } catch (error) {
      results[target] = `error:${error instanceof Error ? error.message : String(error)}`;
    }
  }
  const successIds = Object.values(results).filter((value) => !value.startsWith("error:"));
  if (!successIds.length && !input.force) throw new Error(`Không nền tảng nào đăng thành công: ${JSON.stringify(results)}`);
  const post = await prisma.post.create({
    data: {
      caption: project.caption || project.name, hashtags: project.hashtags, imageUrl: project.outputUrl,
      platform: input.targets.length > 1 ? "multi" : input.targets[0], postType: "video", tone: "friendly",
      status: successIds.length ? "published" : "failed", publishedAt: successIds.length ? new Date() : null,
      facebookPageId: project.facebookPageId,
      fbPostId: results.facebook?.startsWith("error:") ? null : results.facebook,
      igPostId: results.instagram?.startsWith("error:") ? null : results.instagram,
      tiktokVideoId: results.tiktok?.startsWith("error:") ? null : results.tiktok,
    },
  });
  await prisma.videoProject.update({ where: { id: project.id }, data: { status: successIds.length ? "published" : project.status, publishedPostId: post.id } });
  return { post, results };
}
