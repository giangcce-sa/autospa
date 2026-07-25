import "server-only";

import { createHash, randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { postToFacebook, postVideoToFacebook } from "@/lib/facebook";
import { postToInstagram, postVideoToInstagram } from "@/lib/instagram";
import { signedMediaUrl, storageKeyFromMediaUrl } from "@/lib/media-storage";
import { postPhotoToTikTok, postVideoToTikTok } from "@/lib/tiktok";
import { postToZalo } from "@/lib/zalo";

export type PublishChannel = "facebook" | "instagram" | "tiktok" | "zalo";
export type PublishMediaType = "image" | "video";

export interface PublishRequest {
  idempotencyKey: string;
  postId: string;
  facebookPageId?: string | null;
  source: string;
  actorId?: string | null;
  revision?: number | null;
  caption: string;
  hashtags?: string | null;
  imageUrl?: string | null;
  mediaType?: PublishMediaType;
  channels: PublishChannel[];
}

export class PublishConflictError extends Error {
  readonly status = 409;
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

function normalizedPayload(input: PublishRequest) {
  return {
    postId: input.postId,
    facebookPageId: input.facebookPageId ?? null,
    revision: input.revision ?? null,
    caption: input.caption,
    hashtags: input.hashtags ?? null,
    imageUrl: input.imageUrl ?? null,
    mediaType: input.mediaType ?? "image",
    channels: [...new Set(input.channels)].sort() as PublishChannel[],
  };
}

export function publishRequestHash(input: PublishRequest) {
  return createHash("sha256").update(JSON.stringify(normalizedPayload(input))).digest("hex");
}

export function latestPublishChannelAttempts<T extends { channel: string }>(attempts: T[]) {
  const latest = new Map<string, T>();
  for (const attempt of attempts) {
    if (!latest.has(attempt.channel)) latest.set(attempt.channel, attempt);
  }
  return [...latest.values()];
}

async function operationSnapshot(id: string) {
  const operation = await prisma.publishOperation.findUniqueOrThrow({
    where: { id },
    select: {
      id: true,
      status: true,
      error: true,
      completedAt: true,
      reconciliationAt: true,
      channelAttempts: {
        orderBy: [{ channel: "asc" }, { attempt: "desc" }],
        select: {
          channel: true,
          status: true,
          externalId: true,
          error: true,
          completedAt: true,
        },
      },
    },
  });
  return {
    ...operation,
    channelAttempts: latestPublishChannelAttempts(operation.channelAttempts),
  };
}

async function findOrCreateOperation(input: PublishRequest) {
  const payload = normalizedPayload(input);
  const requestHash = publishRequestHash(input);
  const existing = await prisma.publishOperation.findFirst({
    where: { OR: [{ idempotencyKey: input.idempotencyKey }, { postId: input.postId, requestHash }] },
  });
  if (existing) {
    if (existing.idempotencyKey === input.idempotencyKey && existing.requestHash !== requestHash) {
      throw new PublishConflictError("Idempotency key đã được dùng cho một yêu cầu publish khác");
    }
    return existing;
  }

  try {
    return await prisma.publishOperation.create({
      data: {
        idempotencyKey: input.idempotencyKey,
        requestHash,
        postId: input.postId,
        facebookPageId: input.facebookPageId ?? null,
        source: input.source,
        actorId: input.actorId ?? null,
        revision: input.revision ?? null,
        payload: JSON.stringify(payload),
      },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const winner = await prisma.publishOperation.findFirstOrThrow({
      where: { OR: [{ idempotencyKey: input.idempotencyKey }, { postId: input.postId, requestHash }] },
    });
    if (winner.idempotencyKey === input.idempotencyKey && winner.requestHash !== requestHash) {
      throw new PublishConflictError("Idempotency key đã được dùng cho một yêu cầu publish khác");
    }
    return winner;
  }
}

async function acquireOperation(operationId: string) {
  const current = await prisma.publishOperation.findUniqueOrThrow({
    where: { id: operationId },
    include: { channelAttempts: { where: { status: "running" }, take: 1 } },
  });
  if (["completed", "needs_reconciliation"].includes(current.status)) return null;
  if (current.status === "running" && current.leaseUntil && current.leaseUntil > new Date()) return null;
  if (current.channelAttempts.length > 0) {
    await prisma.publishOperation.update({
      where: { id: operationId },
      data: {
        status: "needs_reconciliation",
        leaseOwner: null,
        leaseUntil: null,
        reconciliationAt: new Date(),
        error: "Channel đang running khi lease hết hạn; cần đối soát trước khi retry",
      },
    });
    return null;
  }

  const leaseOwner = `publish-${randomUUID()}`;
  const claimed = await prisma.publishOperation.updateMany({
    where: {
      id: operationId,
      status: { in: ["pending", "running", "partial", "failed"] },
      OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }],
    },
    data: {
      status: "running",
      leaseOwner,
      leaseUntil: new Date(Date.now() + 15 * 60_000),
      attempt: { increment: 1 },
      error: null,
      completedAt: null,
    },
  });
  return claimed.count === 1 ? leaseOwner : null;
}

async function latestChannelAttempt(operationId: string, channel: PublishChannel) {
  return prisma.publishChannelAttempt.findFirst({
    where: { operationId, channel },
    orderBy: { attempt: "desc" },
  });
}

async function prepareAttempt(operationId: string, channel: PublishChannel) {
  const latest = await latestChannelAttempt(operationId, channel);
  if (latest?.status === "succeeded" || latest?.status === "needs_reconciliation") return latest;
  if (latest?.status === "pending") return latest;
  return prisma.publishChannelAttempt.create({
    data: {
      operationId,
      channel,
      attempt: (latest?.attempt ?? 0) + 1,
      status: "pending",
    },
  });
}

async function failBeforeOutbound(attemptId: string, error: string) {
  return prisma.publishChannelAttempt.update({
    where: { id: attemptId },
    data: { status: "failed", error, completedAt: new Date() },
  });
}

async function executeChannel(input: PublishRequest, operationId: string, channel: PublishChannel) {
  const previous = await latestChannelAttempt(operationId, channel);
  if (previous?.status === "succeeded" || previous?.status === "needs_reconciliation") return previous;

  const post = await prisma.post.findUniqueOrThrow({
    where: { id: input.postId },
    select: { fbPostId: true, igPostId: true, tiktokVideoId: true },
  });
  const existingExternalId = channel === "facebook"
    ? post.fbPostId
    : channel === "instagram"
      ? post.igPostId
      : channel === "tiktok"
        ? post.tiktokVideoId
        : null;
  if (existingExternalId) {
    return prisma.publishChannelAttempt.create({
      data: {
        operationId,
        channel,
        attempt: (previous?.attempt ?? 0) + 1,
        status: "succeeded",
        externalId: existingExternalId,
        completedAt: new Date(),
      },
    });
  }

  const attempt = await prepareAttempt(operationId, channel);
  const text = `${input.caption}\n\n${input.hashtags ?? ""}`.trim();
  if (!text) return failBeforeOutbound(attempt.id, "Nội dung bài viết đang trống");
  if ((channel === "facebook" || channel === "instagram") && !input.facebookPageId) {
    return failBeforeOutbound(attempt.id, "Bài viết chưa xác định Facebook Page");
  }
  if ((channel === "instagram" || channel === "tiktok") && !input.imageUrl) {
    return failBeforeOutbound(attempt.id, `${channel === "instagram" ? "Instagram" : "TikTok"} yêu cầu media`);
  }

  const page = input.facebookPageId
    ? await prisma.facebookPage.findUnique({ where: { id: input.facebookPageId } })
    : null;
  if ((channel === "facebook" || channel === "instagram") && !page) {
    return failBeforeOutbound(attempt.id, "Không tìm thấy Facebook Page");
  }
  if (channel === "instagram" && !page?.igAccountId) {
    return failBeforeOutbound(attempt.id, "Chưa kết nối Instagram Business");
  }
  const tiktokAccount = channel === "tiktok"
    ? await prisma.tikTokAccount.findFirst({ where: { isActive: true } })
    : null;
  if (channel === "tiktok" && !tiktokAccount) {
    return failBeforeOutbound(attempt.id, "Chưa kết nối TikTok");
  }

  await prisma.publishChannelAttempt.update({
    where: { id: attempt.id },
    data: { status: "running", startedAt: new Date(), error: null },
  });
  const checkpoint = async (providerCheckpoint: string) => {
    await prisma.publishChannelAttempt.update({ where: { id: attempt.id }, data: { providerCheckpoint } });
  };

  try {
    let externalId: string;
    if (channel === "facebook") {
      externalId = input.mediaType === "video"
        ? await postVideoToFacebook(text, input.imageUrl!, input.facebookPageId!)
        : await postToFacebook(text, input.imageUrl ?? undefined, input.facebookPageId!, checkpoint);
    } else if (channel === "instagram") {
      const mediaUrl = input.imageUrl!;
      const storageKey = storageKeyFromMediaUrl(mediaUrl);
      const publicUrl = storageKey ? signedMediaUrl(storageKey, 3600) : mediaUrl;
      externalId = input.mediaType === "video"
        ? await postVideoToInstagram(page!.igAccountId!, page!.accessToken, text, publicUrl, checkpoint)
        : await postToInstagram(page!.igAccountId!, page!.accessToken, text, mediaUrl, checkpoint);
    } else if (channel === "tiktok") {
      externalId = input.mediaType === "video"
        ? (await postVideoToTikTok(tiktokAccount!.accessToken, text, input.imageUrl!)).publishId
        : (await postPhotoToTikTok(tiktokAccount!.accessToken, tiktokAccount!.openId, text, [input.imageUrl!])).publishId;
    } else {
      externalId = await postToZalo(text, input.imageUrl ?? undefined);
    }

    return prisma.publishChannelAttempt.update({
      where: { id: attempt.id },
      data: { status: "succeeded", externalId, error: null, completedAt: new Date() },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return prisma.publishChannelAttempt.update({
      where: { id: attempt.id },
      data: { status: "needs_reconciliation", error: message, completedAt: new Date() },
    });
  }
}

async function finalizeOperation(operationId: string, channels: PublishChannel[]) {
  const attempts = await prisma.publishChannelAttempt.findMany({
    where: { operationId },
    orderBy: [{ channel: "asc" }, { attempt: "desc" }],
  });
  const latest = new Map<string, (typeof attempts)[number]>();
  for (const attempt of attempts) if (!latest.has(attempt.channel)) latest.set(attempt.channel, attempt);

  const selected = channels.map((channel) => latest.get(channel)).filter((attempt) => attempt !== undefined);
  const succeeded = selected.filter((attempt) => attempt.status === "succeeded");
  const ambiguous = selected.filter((attempt) => attempt.status === "needs_reconciliation");
  const failed = selected.filter((attempt) => attempt.status === "failed");
  const status = ambiguous.length > 0
    ? "needs_reconciliation"
    : succeeded.length === channels.length
      ? "completed"
      : succeeded.length > 0
        ? "partial"
        : "failed";
  const operation = await prisma.publishOperation.findUniqueOrThrow({ where: { id: operationId } });
  const external = Object.fromEntries(succeeded.map((attempt) => [attempt.channel, attempt.externalId]));
  const postStatus = status === "completed"
    ? "published"
    : status === "partial"
      ? "partially_published"
      : status === "needs_reconciliation"
        ? "publish_reconciliation"
        : "publish_failed";

  await prisma.$transaction([
    prisma.post.update({
      where: { id: operation.postId },
      data: {
        status: postStatus,
        publishedAt: succeeded.length > 0 ? new Date() : null,
        ...(typeof external.facebook === "string" && { fbPostId: external.facebook }),
        ...(typeof external.instagram === "string" && { igPostId: external.instagram }),
        ...(typeof external.tiktok === "string" && { tiktokVideoId: external.tiktok }),
      },
    }),
    prisma.publishOperation.update({
      where: { id: operationId },
      data: {
        status,
        error: [...ambiguous, ...failed].map((attempt) => `${attempt.channel}: ${attempt.error ?? attempt.status}`).join("; ") || null,
        completedAt: ["completed", "partial", "failed"].includes(status) ? new Date() : null,
        reconciliationAt: status === "needs_reconciliation" ? new Date() : null,
        leaseOwner: null,
        leaseUntil: null,
      },
    }),
  ]);

  return operationSnapshot(operationId);
}

export async function executePublishOperation(input: PublishRequest) {
  const payload = normalizedPayload(input);
  if (!input.idempotencyKey.trim()) throw new Error("Thiếu idempotency key");
  if (payload.channels.length === 0) throw new Error("Chưa chọn kênh publish");

  const post = await prisma.post.findUnique({ where: { id: input.postId }, select: { facebookPageId: true } });
  if (!post) throw new Error("Không tìm thấy bài viết");
  if (post.facebookPageId && post.facebookPageId !== payload.facebookPageId) {
    throw new PublishConflictError("Bài viết thuộc Facebook Page khác");
  }

  const operation = await findOrCreateOperation(input);
  const leaseOwner = await acquireOperation(operation.id);
  if (!leaseOwner) return operationSnapshot(operation.id);

  for (const channel of payload.channels) {
    await executeChannel(input, operation.id, channel);
  }
  return finalizeOperation(operation.id, payload.channels);
}

export async function reconcileExpiredPublishOperations() {
  const expired = await prisma.publishOperation.findMany({
    where: { status: "running", leaseUntil: { lt: new Date() } },
    select: { id: true },
    take: 50,
  });
  let retryable = 0;
  let ambiguous = 0;

  for (const operation of expired) {
    const running = await prisma.publishChannelAttempt.count({ where: { operationId: operation.id, status: "running" } });
    if (running > 0) {
      await prisma.publishOperation.update({
        where: { id: operation.id },
        data: {
          status: "needs_reconciliation",
          reconciliationAt: new Date(),
          error: "Lease hết hạn sau khi channel outbound đã bắt đầu",
          leaseOwner: null,
          leaseUntil: null,
        },
      });
      ambiguous += 1;
    } else {
      await prisma.publishOperation.update({
        where: { id: operation.id },
        data: { status: "pending", leaseOwner: null, leaseUntil: null },
      });
      retryable += 1;
    }
  }

  return { checked: expired.length, retryable, ambiguous };
}
