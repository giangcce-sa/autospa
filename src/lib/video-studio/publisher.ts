import "server-only";

import { prisma } from "@/lib/db";
import { executePublishOperation } from "@/lib/publishing/service";
import { assertProjectPublishConsent } from "./consent";

export type VideoPublishTarget = "facebook" | "instagram" | "tiktok";

export async function publishVideoProject(input: {
  projectId: string;
  targets: VideoPublishTarget[];
  force?: boolean;
  revision: number;
}) {
  const project = await prisma.videoProject.findUnique({ where: { id: input.projectId } });
  if (!project) throw new Error("Không tìm thấy dự án");
  if (
    project.inputRevision !== input.revision
    || project.renderedRevision !== input.revision
    || project.approvedRevision !== input.revision
  ) {
    throw new Error("Dự án đã thay đổi sau khi lệnh publish được tạo");
  }
  if (project.approvalStatus !== "approved" || !project.outputUrl || (project.qualityScore || 0) < 75) {
    throw new Error("Video phải được render, vượt QA và duyệt trước khi đăng");
  }
  if (project.outputUrl.startsWith("mock://")) throw new Error("Không thể đăng output mock");
  await assertProjectPublishConsent(project.id);

  const targets = [...new Set(input.targets)].sort() as VideoPublishTarget[];
  let post = project.publishedPostId
    ? await prisma.post.findUnique({ where: { id: project.publishedPostId } })
    : null;
  if (post && post.facebookPageId !== project.facebookPageId) {
    throw new Error("Bài publish của dự án thuộc Facebook Page khác");
  }
  if (!post) {
    post = await prisma.$transaction(async (tx) => {
      const created = await tx.post.create({
        data: {
          caption: project.caption || project.name,
          hashtags: project.hashtags,
          imageUrl: project.outputUrl,
          platform: targets.length > 1 ? "multi" : targets[0],
          postType: "video",
          tone: "friendly",
          status: "publishing",
          facebookPageId: project.facebookPageId,
        },
      });
      await tx.videoProject.update({
        where: { id: project.id },
        data: { publishedPostId: created.id, status: "publishing" },
      });
      return created;
    });
  }

  const operation = await executePublishOperation({
    idempotencyKey: `video:${project.id}:${input.revision}:${targets.join(",")}`,
    postId: post.id,
    facebookPageId: project.facebookPageId,
    source: "video",
    revision: input.revision,
    caption: project.caption || project.name,
    hashtags: project.hashtags,
    imageUrl: project.outputUrl,
    mediaType: "video",
    channels: targets,
  });
  const successful = operation.channelAttempts.filter((attempt) => attempt.status === "succeeded");
  if (successful.length === 0 && operation.status === "failed" && !input.force) {
    throw new Error(operation.error || "Không nền tảng nào đăng thành công");
  }

  await prisma.videoProject.update({
    where: { id: project.id },
    data: {
      status: operation.status === "completed"
        ? "published"
        : operation.status === "needs_reconciliation"
          ? "publish_reconciliation"
          : operation.status,
    },
  });
  const updatedPost = await prisma.post.findUniqueOrThrow({ where: { id: post.id } });
  const results = Object.fromEntries(
    operation.channelAttempts.map((attempt) => [
      attempt.channel,
      attempt.externalId ?? `${attempt.status}:${attempt.error ?? ""}`,
    ]),
  );

  return { post: updatedPost, operation, results };
}
