import "server-only";

import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { parseJson } from "./types";

export async function enqueueInternalVideoJob(input: { projectId: string; sceneId?: string; type: "render" | "learning" | "publish"; payload?: unknown; idempotencyKey: string }) {
  const existing = await prisma.videoJob.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing && !["failed", "cancelled"].includes(existing.status)) return existing;
  if (existing) return prisma.videoJob.update({ where: { id: existing.id }, data: {
    status: "queued", progress: 0, error: null, output: null, completedAt: null, nextPollAt: new Date(),
    leaseOwner: null, leaseUntil: null, cancelRequested: false, attempt: { increment: 1 }, input: JSON.stringify(input.payload || {}),
  } });
  return prisma.videoJob.create({ data: {
    projectId: input.projectId, sceneId: input.sceneId, type: input.type, provider: "internal",
    idempotencyKey: input.idempotencyKey, input: JSON.stringify(input.payload || {}), status: "queued", nextPollAt: new Date(),
  } });
}

async function claimInternalJobs(limit: number, workerId: string) {
  const candidates = await prisma.videoJob.findMany({
    where: {
      provider: "internal", status: { in: ["queued", "processing"] }, cancelRequested: false,
      AND: [
        { OR: [{ nextPollAt: null }, { nextPollAt: { lte: new Date() } }] },
        { OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }] },
      ],
    },
    orderBy: { createdAt: "asc" }, take: Math.min(Math.max(limit, 1), 5),
  });
  const claimed = [];
  for (const job of candidates) {
    const result = await prisma.videoJob.updateMany({
      where: { id: job.id, status: { in: ["queued", "processing"] }, cancelRequested: false, OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }] },
      data: { status: "processing", leaseOwner: workerId, leaseUntil: new Date(Date.now() + 30 * 60_000), lastHeartbeatAt: new Date(), startedAt: job.startedAt || new Date(), progress: Math.max(job.progress, 2) },
    });
    if (result.count) claimed.push({ ...job, leaseOwner: workerId });
  }
  return claimed;
}

async function completeInternalJob(jobId: string, output: unknown) {
  const current = await prisma.videoJob.findUnique({ where: { id: jobId } });
  if (!current) throw new Error("Không tìm thấy internal job");
  if (current.cancelRequested || current.status === "cancelled") return current;
  return prisma.videoJob.update({ where: { id: jobId }, data: {
    status: "completed", progress: 100, output: JSON.stringify(output), error: null,
    completedAt: new Date(), nextPollAt: null, leaseOwner: null, leaseUntil: null, lastHeartbeatAt: new Date(),
  } });
}

async function failInternalJob(job: { id: string; attempt: number; maxAttempts: number }, error: unknown) {
  const current = await prisma.videoJob.findUnique({ where: { id: job.id } });
  if (!current) throw new Error("Không tìm thấy internal job");
  if (current.cancelRequested || current.status === "cancelled") return current;
  const attempt = job.attempt + 1;
  const terminal = attempt >= job.maxAttempts;
  return prisma.videoJob.update({ where: { id: job.id }, data: {
    attempt, status: terminal ? "failed" : "queued", error: error instanceof Error ? error.message : String(error),
    nextPollAt: terminal ? null : new Date(Date.now() + Math.min(5 * 60_000, 15_000 * 2 ** attempt)),
    completedAt: terminal ? new Date() : null, leaseOwner: null, leaseUntil: null,
  } });
}

async function processInternalJob(job: { id: string; projectId: string; type: string; input: string; attempt: number; maxAttempts: number }) {
  try {
    if (job.type === "render") {
      const input = parseJson<{ revision?: number }>(job.input, {});
      const project = await prisma.videoProject.findUnique({ where: { id: job.projectId }, select: { inputRevision: true } });
      if (!project || project.inputRevision !== input.revision) throw new Error("Render job đã lỗi thời do dự án thay đổi");
      const { runProjectQuality } = await import("./service");
      const before = await runProjectQuality(job.projectId);
      if (!before.passed) throw new Error(`QUALITY_BLOCKED:${JSON.stringify(before.issues)}`);
      await prisma.videoJob.update({ where: { id: job.id }, data: { progress: 20, lastHeartbeatAt: new Date() } });
      const active = await prisma.videoJob.findUnique({ where: { id: job.id }, select: { cancelRequested: true } });
      if (active?.cancelRequested) throw new Error("Job đã bị hủy");
      const { renderVideoProject } = await import("./render");
      const rendered = await renderVideoProject(job.projectId);
      const quality = await runProjectQuality(job.projectId);
      return completeInternalJob(job.id, { ...rendered, quality });
    }
    if (job.type === "learning") {
      const input = parseJson<{ assetId?: string; facebookPageId?: string | null }>(job.input, {});
      if (!input.assetId) throw new Error("Learning job thiếu assetId");
      await prisma.videoJob.update({ where: { id: job.id }, data: { progress: 15, lastHeartbeatAt: new Date() } });
      const { analyzeSourceVideo } = await import("./learning");
      const result = await analyzeSourceVideo({ assetId: input.assetId, projectId: job.projectId, facebookPageId: input.facebookPageId });
      return completeInternalJob(job.id, result);
    }
    if (job.type === "publish") {
      const input = parseJson<{ targets?: Array<"facebook" | "instagram" | "tiktok">; force?: boolean; revision?: number }>(job.input, {});
      if (!input.targets?.length || input.revision == null) throw new Error("Publish job thiếu target hoặc revision");
      await prisma.videoJob.update({ where: { id: job.id }, data: { progress: 10, lastHeartbeatAt: new Date() } });
      const { publishVideoProject } = await import("./publisher");
      const result = await publishVideoProject({ projectId: job.projectId, targets: input.targets, force: input.force, revision: input.revision });
      return completeInternalJob(job.id, result);
    }
    throw new Error(`Internal job type chưa được hỗ trợ: ${job.type}`);
  } catch (error) {
    return failInternalJob(job, error);
  }
}

export async function processInternalVideoJobs(limit = 1) {
  const workerId = `video-worker-${randomUUID()}`;
  const jobs = await claimInternalJobs(limit, workerId);
  const results = [];
  for (const job of jobs) results.push(await processInternalJob(job));
  return results;
}
