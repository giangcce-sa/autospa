import "server-only";

import { prisma } from "@/lib/db";
import { getBusinessDayRange } from "@/lib/today-policy";
import { videoRevisionState } from "@/lib/media-gallery";

/**
 * Context-rail read models for the Sáng tạo studios (content, images, video,
 * publishing). Stored columns only — no estimates, no per-request external
 * calls. Where the app has no data the field is simply absent.
 */

function countsByKey<T extends string>(rows: Array<{ _count: { _all: number } } & Record<string, unknown>>, key: string) {
  const map = new Map<T, number>();
  for (const row of rows) {
    const value = row[key];
    if (typeof value === "string") map.set(value as T, row._count._all);
  }
  return map;
}

function pick(map: Map<string, number>, key: string) {
  return map.get(key) ?? 0;
}

/* ── Biên tập nội dung ─────────────────────────────────── */

export async function getContentStudioData({ facebookPageId }: { facebookPageId: string }) {
  const [statusRows, reviewRows, quality, generations, editStats] = await Promise.all([
    prisma.post.groupBy({ by: ["status"], where: { facebookPageId }, _count: { _all: true } }),
    prisma.contentReview.groupBy({ by: ["status"], where: { post: { facebookPageId } }, _count: { _all: true } }),
    prisma.post.aggregate({
      where: { facebookPageId, qualityScore: { not: null } },
      _avg: { qualityScore: true },
      _count: { _all: true },
    }),
    prisma.contentGeneration.findMany({
      where: { facebookPageId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, postId: true, humanScore: true, userAccepted: true, mode: true, narrator: true, createdAt: true },
    }),
    prisma.contentGeneration.aggregate({
      where: { facebookPageId },
      _avg: { humanScore: true },
      _count: { _all: true },
    }),
  ]);

  const status = countsByKey(statusRows, "status");
  const review = countsByKey(reviewRows, "status");

  return {
    status: {
      draft: pick(status, "draft"),
      scheduled: pick(status, "scheduled"),
      published: pick(status, "published"),
      total: [...status.values()].reduce((sum, value) => sum + value, 0),
    },
    review: {
      pass: pick(review, "pass"),
      warn: pick(review, "warn"),
      fail: pick(review, "fail"),
      total: [...review.values()].reduce((sum, value) => sum + value, 0),
    },
    quality: {
      avg: quality._avg.qualityScore === null ? null : Math.round(quality._avg.qualityScore),
      scored: quality._count._all,
    },
    humanScore: {
      avg: editStats._avg.humanScore === null ? null : Math.round(editStats._avg.humanScore),
      total: editStats._count._all,
    },
    generations: generations.map((generation) => ({
      ...generation,
      createdAt: generation.createdAt.toISOString(),
    })),
  };
}

/* ── Xưởng hình ảnh ────────────────────────────────────── */

export async function getImageStudioData({ facebookPageId }: { facebookPageId: string }) {
  const [presetRows, formatRows, acceptedRows, scores, consentRows, brand] = await Promise.all([
    prisma.imageGeneration.groupBy({
      by: ["preset"],
      where: { facebookPageId },
      _count: { _all: true },
      orderBy: { _count: { preset: "desc" } },
    }),
    prisma.imageGeneration.groupBy({ by: ["format"], where: { facebookPageId }, _count: { _all: true } }),
    prisma.imageGeneration.groupBy({ by: ["userAccepted"], where: { facebookPageId }, _count: { _all: true } }),
    prisma.imageGeneration.aggregate({
      where: { facebookPageId },
      _avg: { qualityScore: true, visionScore: true, latencyMs: true },
      _sum: { estimatedCostUsd: true },
      _count: { _all: true },
    }),
    prisma.staffVisualProfile.groupBy({
      by: ["consentStatus"],
      where: { facebookPageId, isActive: true },
      _count: { _all: true },
    }),
    prisma.brandKit.findUnique({
      where: { facebookPageId },
      select: { logoUrl: true, primaryColor: true, accentColor: true, spaName: true },
    }),
  ]);

  const consent = countsByKey(consentRows, "consentStatus");
  const accepted = acceptedRows.reduce(
    (acc, row) => {
      if (row.userAccepted === true) acc.accepted = row._count._all;
      else if (row.userAccepted === false) acc.rejected = row._count._all;
      else acc.pending = row._count._all;
      return acc;
    },
    { accepted: 0, rejected: 0, pending: 0 },
  );

  return {
    presets: presetRows.map((row) => ({ preset: row.preset, count: row._count._all })),
    formats: formatRows.map((row) => ({ format: row.format, count: row._count._all })),
    accepted,
    scores: {
      total: scores._count._all,
      quality: scores._avg.qualityScore === null ? null : Math.round(scores._avg.qualityScore),
      vision: scores._avg.visionScore === null ? null : Math.round(scores._avg.visionScore),
      latencyMs: scores._avg.latencyMs === null ? null : Math.round(scores._avg.latencyMs),
      costUsd: scores._sum.estimatedCostUsd ?? 0,
    },
    consent: {
      consented: pick(consent, "consented"),
      pending: pick(consent, "pending"),
      revoked: pick(consent, "revoked"),
    },
    brand,
  };
}

/* ── Xưởng video ───────────────────────────────────────── */

export async function getVideoStudioData({ facebookPageId }: { facebookPageId: string }) {
  const [statusRows, approvalRows, projects, sceneAgg, jobRows, consentRows, performance] = await Promise.all([
    prisma.videoProject.groupBy({ by: ["status"], where: { facebookPageId }, _count: { _all: true } }),
    prisma.videoProject.groupBy({ by: ["approvalStatus"], where: { facebookPageId }, _count: { _all: true } }),
    prisma.videoProject.findMany({
      where: { facebookPageId },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: { id: true, inputRevision: true, renderedRevision: true, approvedRevision: true, qualityScore: true },
    }),
    prisma.videoScene.aggregate({
      where: { project: { facebookPageId } },
      _sum: { durationSec: true },
      _count: { _all: true },
    }),
    prisma.videoJob.groupBy({ by: ["status"], where: { project: { facebookPageId } }, _count: { _all: true } }),
    prisma.videoConsent.groupBy({ by: ["status"], where: { facebookPageId }, _count: { _all: true } }),
    prisma.videoPerformance.findMany({
      where: { project: { facebookPageId } },
      orderBy: { capturedAt: "desc" },
      take: 5,
      select: { projectId: true, platform: true, views: true, completionRate: true, capturedAt: true },
    }),
  ]);

  const status = countsByKey(statusRows, "status");
  const approval = countsByKey(approvalRows, "approvalStatus");
  const job = countsByKey(jobRows, "status");
  const consent = countsByKey(consentRows, "status");

  // Reuse the app's own revision helper instead of recomputing freshness rules.
  const revision = projects.reduce(
    (acc, project) => {
      const state = videoRevisionState(project.inputRevision, project.renderedRevision, project.approvedRevision);
      if (!state.renderFresh) acc.needsRender += 1;
      else if (!state.approvalFresh) acc.needsApproval += 1;
      else acc.ready += 1;
      return acc;
    },
    { needsRender: 0, needsApproval: 0, ready: 0 },
  );

  return {
    status: {
      draft: pick(status, "draft"),
      rendering: pick(status, "rendering"),
      rendered: pick(status, "rendered"),
      published: pick(status, "published"),
      total: [...status.values()].reduce((sum, value) => sum + value, 0),
    },
    approval: {
      draft: pick(approval, "draft"),
      pending: pick(approval, "pending"),
      approved: pick(approval, "approved"),
      rejected: pick(approval, "rejected"),
    },
    revision,
    scenes: { count: sceneAgg._count._all, durationSec: sceneAgg._sum.durationSec ?? 0 },
    jobs: {
      queued: pick(job, "queued"),
      running: pick(job, "running"),
      failed: pick(job, "failed"),
      completed: pick(job, "completed"),
      total: [...job.values()].reduce((sum, value) => sum + value, 0),
    },
    consent: {
      granted: pick(consent, "granted"),
      pending: pick(consent, "pending"),
      revoked: pick(consent, "revoked"),
    },
    performance: performance.map((row) => ({ ...row, capturedAt: row.capturedAt.toISOString() })),
  };
}

/* ── Đăng bài & Thư viện ───────────────────────────────── */

export async function getPublishingStudioData({
  facebookPageId,
  now = new Date(),
}: {
  facebookPageId: string;
  now?: Date;
}) {
  const { start: dayStart, end: dayEnd } = getBusinessDayRange(now);

  const [statusRows, opRows, channelRows, scheduledToday, overdue] = await Promise.all([
    prisma.post.groupBy({ by: ["status"], where: { facebookPageId }, _count: { _all: true } }),
    prisma.publishOperation.groupBy({ by: ["status"], where: { facebookPageId }, _count: { _all: true } }),
    prisma.publishChannelAttempt.groupBy({
      by: ["channel", "status"],
      where: { operation: { facebookPageId } },
      _count: { _all: true },
    }),
    prisma.post.findMany({
      where: { facebookPageId, scheduledAt: { gte: dayStart, lte: dayEnd }, status: { in: ["draft", "scheduled", "published"] } },
      orderBy: { scheduledAt: "asc" },
      take: 10,
      select: { id: true, caption: true, platform: true, status: true, scheduledAt: true },
    }),
    prisma.post.count({ where: { facebookPageId, status: "scheduled", scheduledAt: { lt: dayStart } } }),
  ]);

  const status = countsByKey(statusRows, "status");
  const operations = countsByKey(opRows, "status");

  // Attempts, not posts — a retry inflates the raw count, so label it as attempts.
  const channels = new Map<string, { succeeded: number; failed: number; other: number }>();
  for (const row of channelRows) {
    const bucket = channels.get(row.channel) ?? { succeeded: 0, failed: 0, other: 0 };
    if (row.status === "succeeded") bucket.succeeded += row._count._all;
    else if (row.status === "failed") bucket.failed += row._count._all;
    else bucket.other += row._count._all;
    channels.set(row.channel, bucket);
  }

  return {
    status: {
      draft: pick(status, "draft"),
      scheduled: pick(status, "scheduled"),
      published: pick(status, "published"),
      total: [...status.values()].reduce((sum, value) => sum + value, 0),
    },
    operations: {
      pending: pick(operations, "pending"),
      processing: pick(operations, "processing"),
      succeeded: pick(operations, "succeeded"),
      failed: pick(operations, "failed"),
      needsReconciliation: pick(operations, "needs_reconciliation"),
    },
    channels: [...channels.entries()].map(([channel, counts]) => ({ channel, ...counts })),
    scheduledToday: scheduledToday.map((row) => ({ ...row, scheduledAt: row.scheduledAt!.toISOString() })),
    overdue,
  };
}

export type ContentStudioData = Awaited<ReturnType<typeof getContentStudioData>>;
export type ImageStudioData = Awaited<ReturnType<typeof getImageStudioData>>;
export type VideoStudioSummary = Awaited<ReturnType<typeof getVideoStudioData>>;
export type PublishingStudioData = Awaited<ReturnType<typeof getPublishingStudioData>>;
