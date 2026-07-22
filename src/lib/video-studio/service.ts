import "server-only";

import { prisma } from "@/lib/db";
import { signedMediaUrl, storageKeyFromMediaUrl } from "@/lib/media-storage";
import { generateStoryboard } from "./storyboard";
import { evaluateProjectQuality } from "./quality";
import { createRunwayTask, getRunwayTask } from "./providers/runway";
import { createLipSyncTask, getLipSyncTask } from "./providers/sync-labs";
import { synthesizeSpeech } from "./providers/elevenlabs";
import { getVideoProviderConfig } from "./config";
import { parseJson, type ProviderTask } from "./types";
import { assertStaffConsent } from "./consent";
import { inspectRenderedVideo } from "./render-inspection";
import { invalidatedProjectRenderData } from "./invalidation";

export const projectInclude = {
  scenes: { orderBy: { position: "asc" as const } },
  assets: { orderBy: { createdAt: "desc" as const } },
  jobs: { orderBy: { createdAt: "desc" as const }, take: 40 },
  versions: { orderBy: { version: "desc" as const }, take: 12 },
  performances: { orderBy: { capturedAt: "desc" as const }, take: 20 },
};

function publicProviderUrl(url: string) {
  const key = storageKeyFromMediaUrl(url);
  return key ? signedMediaUrl(key, 3600) : url;
}

async function createJob(input: {
  projectId: string;
  sceneId?: string;
  type: string;
  provider: string;
  payload: unknown;
  estimate?: number;
  idempotencyKey: string;
}) {
  const config = await getVideoProviderConfig();
  return prisma.$transaction(async (tx) => {
    const existing = await tx.videoJob.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing && !["failed", "cancelled"].includes(existing.status)) return { job: existing, reused: true };
    const project = await tx.videoProject.findUnique({ where: { id: input.projectId }, select: { actualCostUsd: true, reservedCostUsd: true } });
    if (!project) throw new Error("Không tìm thấy dự án video");
    const estimate = input.estimate || 0;
    if (project.actualCostUsd + project.reservedCostUsd + estimate > config.budgetUsd) {
      throw new Error(`Tác vụ vượt trần ngân sách video ${config.budgetUsd.toFixed(2)} USD`);
    }
    await tx.videoProject.update({ where: { id: input.projectId }, data: { reservedCostUsd: { increment: estimate }, estimatedCostUsd: { increment: estimate } } });
    const retry = existing ? existing.attempt + 1 : 0;
    const job = existing
      ? await tx.videoJob.update({ where: { id: existing.id }, data: { status: "processing", progress: 2, attempt: retry, error: null, startedAt: new Date(), completedAt: null, estimatedCostUsd: estimate } })
      : await tx.videoJob.create({
          data: {
            projectId: input.projectId, sceneId: input.sceneId, type: input.type, provider: input.provider,
            input: JSON.stringify(input.payload), estimatedCostUsd: estimate, idempotencyKey: input.idempotencyKey,
            status: "processing", progress: 2, startedAt: new Date(),
          },
        });
    return { job, reused: false };
  }, { isolationLevel: "Serializable" });
}

async function finishJob(jobId: string, result: ProviderTask) {
  return prisma.$transaction(async (tx) => {
    const job = await tx.videoJob.findUnique({ where: { id: jobId } });
    if (!job) throw new Error("Không tìm thấy video job");
    const status = result.status;
    const terminal = ["completed", "failed", "cancelled"].includes(status);
    const wasTerminal = ["completed", "failed", "cancelled"].includes(job.status);
    const actualCost = status === "completed" ? (result.costUsd ?? job.estimatedCostUsd) : 0;
    const updated = await tx.videoJob.update({
      where: { id: jobId },
      data: {
        externalId: result.externalId ?? job.externalId, status,
        progress: result.progress ?? (status === "completed" ? 100 : 10),
        output: JSON.stringify(result.raw ?? (result.outputUrl ? { outputUrl: result.outputUrl } : {})),
        error: result.error, actualCostUsd: terminal ? actualCost : undefined,
        nextPollAt: ["queued", "processing"].includes(status) ? new Date(Date.now() + 8_000) : null,
        completedAt: terminal ? new Date() : null,
        leaseOwner: terminal ? null : undefined, leaseUntil: terminal ? null : undefined,
      },
    });
    if (terminal && !wasTerminal) {
      const project = await tx.videoProject.findUnique({ where: { id: job.projectId }, select: { reservedCostUsd: true } });
      await tx.videoProject.update({
        where: { id: job.projectId },
        data: {
          reservedCostUsd: Math.max(0, (project?.reservedCostUsd || 0) - job.estimatedCostUsd),
          actualCostUsd: { increment: actualCost },
        },
      });
    }
    return updated;
  }, { isolationLevel: "Serializable" });
}

async function failJob(jobId: string, error: unknown) {
  return finishJob(jobId, { status: "failed", error: error instanceof Error ? error.message : String(error) });
}

export async function buildStoryboard(projectId: string) {
  const project = await prisma.videoProject.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("Không tìm thấy dự án");
  const service = project.serviceId ? await prisma.service.findUnique({ where: { id: project.serviceId }, select: { name: true } }) : null;
  const skills = parseJson<string[]>(project.styleSkillIds, []);
  const skillContext = skills.length
    ? await prisma.videoSkill.findMany({ where: { id: { in: skills }, status: "approved" }, select: { name: true, description: true, rules: true } })
    : [];
  const result = await generateStoryboard({
    name: project.name,
    brief: project.brief,
    objective: project.objective,
    platform: project.platform,
    aspectRatio: project.aspectRatio,
    durationSec: project.durationSec,
    serviceName: service?.name,
    skillContext: skillContext.map((skill) => `${skill.name}: ${skill.description}; ${skill.rules}`),
  });
  await prisma.$transaction(async (tx) => {
    await tx.videoScene.deleteMany({ where: { projectId, locked: false } });
    const locked = await tx.videoScene.findMany({ where: { projectId, locked: true }, select: { position: true } });
    const occupied = new Set(locked.map((scene) => scene.position));
    let position = 0;
    for (const scene of result.scenes) {
      while (occupied.has(position)) position += 1;
      await tx.videoScene.create({
        data: {
          projectId,
          position,
          title: scene.title,
          kind: scene.kind,
          purpose: scene.purpose,
          durationSec: scene.durationSec,
          script: scene.script,
          visualPrompt: scene.visualPrompt,
          cameraDirection: scene.cameraDirection,
          staffProfileId: project.staffProfileId,
          voiceProfileId: project.voiceProfileId,
        },
      });
      position += 1;
    }
    await tx.videoProject.update({
      where: { id: projectId },
      data: {
        storyboard: JSON.stringify(result),
        caption: result.caption,
        hashtags: result.hashtags.join(" "),
        ...invalidatedProjectRenderData(),
      },
    });
  });
  return result;
}

export async function generateSceneVideo(sceneId: string) {
  const scene = await prisma.videoScene.findUnique({ where: { id: sceneId }, include: { project: true } });
  if (!scene) throw new Error("Không tìm thấy cảnh");
  const estimate = Math.max(scene.durationSec, 5) * 0.05;
  const created = await createJob({ projectId: scene.projectId, sceneId, type: "video_generation", provider: "runway", payload: scene, estimate, idempotencyKey: `runway:${scene.id}:${scene.inputRevision}` });
  const job = created.job;
  if (created.reused) return { jobId: job.id, status: job.status, reused: true };
  try {
    const result = await createRunwayTask({
      prompt: scene.visualPrompt,
      imageUrl: scene.sourceImageUrl ? publicProviderUrl(scene.sourceImageUrl) : undefined,
      ratio: scene.project.aspectRatio,
      durationSec: scene.durationSec,
    });
    await finishJob(job.id, result);
    await prisma.videoScene.update({
      where: { id: sceneId },
      data: {
        provider: "runway",
        providerTaskId: result.externalId,
        status: result.status === "completed" ? "video_ready" : "generating",
        generatedVideoUrl: result.outputUrl || (result.externalId?.startsWith("mock-") ? `mock://runway/${sceneId}` : undefined),
        videoRevision: scene.inputRevision,
      },
    });
    return { jobId: job.id, ...result };
  } catch (error) {
    await failJob(job.id, error);
    throw error;
  }
}

export async function generateSceneVoice(sceneId: string) {
  const scene = await prisma.videoScene.findUnique({ where: { id: sceneId }, include: { project: true } });
  if (!scene) throw new Error("Không tìm thấy cảnh");
  if (!scene.script.trim()) throw new Error("Cảnh chưa có lời thoại");
  const profileId = scene.voiceProfileId || scene.project.voiceProfileId;
  const profile = profileId ? await prisma.videoVoiceProfile.findUnique({ where: { id: profileId } }) : null;
  if (!profile) throw new Error("Hãy chọn voice profile trước khi tạo giọng");
  if (profile.status !== "active") throw new Error("Voice profile chưa được duyệt hoặc chưa hoạt động");
  const estimate = scene.script.length * 0.00003;
  const created = await createJob({ projectId: scene.projectId, sceneId, type: "speech", provider: "elevenlabs", payload: { script: scene.script, voiceProfileId: profile.id }, estimate, idempotencyKey: `voice:${scene.id}:${scene.inputRevision}` });
  const job = created.job;
  if (created.reused) return { jobId: job.id, status: job.status, reused: true };
  try {
    const result = await synthesizeSpeech({
      text: scene.script,
      voiceId: profile.providerVoiceId || undefined,
      settings: parseJson(profile.settings, {}),
    });
    const audioUrl = result.url || `mock://audio/${sceneId}`;
    await finishJob(job.id, { status: "completed", progress: 100, raw: result });
    await prisma.$transaction([
      prisma.videoScene.update({ where: { id: sceneId }, data: { audioUrl, subtitleData: JSON.stringify(result.alignment), status: "voice_ready", audioRevision: scene.inputRevision } }),
      prisma.videoAsset.create({ data: { projectId: scene.projectId, sceneId, type: "audio", source: "elevenlabs", name: `${scene.title} - voice`, url: audioUrl, storageKey: result.storageKey, mimeType: "audio/mpeg" } }),
    ]);
    return { jobId: job.id, ...result };
  } catch (error) {
    await failJob(job.id, error);
    throw error;
  }
}

async function assertLipSyncConsent(scene: { staffProfileId: string | null; project: { staffProfileId: string | null; facebookPageId: string | null } }) {
  const staffId = scene.staffProfileId || scene.project.staffProfileId;
  if (!staffId) throw new Error("Cảnh lip-sync chưa chọn nhân viên");
  await assertStaffConsent({ staffId, facebookPageId: scene.project.facebookPageId, scopes: ["lip_sync"] });
}

export async function generateSceneLipSync(sceneId: string) {
  const scene = await prisma.videoScene.findUnique({ where: { id: sceneId }, include: { project: true } });
  if (!scene) throw new Error("Không tìm thấy cảnh");
  await assertLipSyncConsent(scene);
  const visualUrl = scene.generatedVideoUrl || scene.sourceVideoUrl || scene.sourceImageUrl;
  if (!visualUrl || !scene.audioUrl) throw new Error("Cảnh cần có hình/video và voice trước khi lip-sync");
  const estimate = Math.max(scene.durationSec, 5) * 0.04;
  const created = await createJob({ projectId: scene.projectId, sceneId, type: "lip_sync", provider: "sync", payload: { visualUrl, audioUrl: scene.audioUrl }, estimate, idempotencyKey: `sync:${scene.id}:${scene.inputRevision}` });
  const job = created.job;
  if (created.reused) return { jobId: job.id, status: job.status, reused: true };
  try {
    const result = await createLipSyncTask({ visualUrl: publicProviderUrl(visualUrl), audioUrl: publicProviderUrl(scene.audioUrl) });
    await finishJob(job.id, result);
    await prisma.videoScene.update({
      where: { id: sceneId },
      data: {
        lipSyncVideoUrl: result.outputUrl || (result.externalId?.startsWith("mock-") ? `mock://sync/${sceneId}` : undefined),
        lipSyncRevision: scene.inputRevision,
        status: result.status === "completed" ? "ready" : "lip_syncing",
      },
    });
    return { jobId: job.id, ...result };
  } catch (error) {
    await failJob(job.id, error);
    throw error;
  }
}

export async function pollVideoJob(jobId: string) {
  const job = await prisma.videoJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error("Không tìm thấy job");
  if (!["queued", "processing"].includes(job.status) || !job.externalId) return job;
  let result: ProviderTask;
  try {
    if (job.provider === "runway") result = await getRunwayTask(job.externalId);
    else if (job.provider === "sync") result = await getLipSyncTask(job.externalId);
    else return job;
  } catch (error) {
    const attempt = job.attempt + 1;
    if (attempt >= job.maxAttempts) return failJob(job.id, error);
    return prisma.videoJob.update({
      where: { id: job.id },
      data: {
        attempt,
        status: "processing",
        error: error instanceof Error ? error.message : String(error),
        nextPollAt: new Date(Date.now() + Math.min(60_000, 5_000 * 2 ** attempt)),
      },
    });
  }
  const updated = await finishJob(job.id, result);
  if (job.sceneId && result.status === "completed") {
    const scene = await prisma.videoScene.findUnique({ where: { id: job.sceneId }, select: { inputRevision: true } });
    const submitted = parseJson<{ inputRevision?: number }>(job.input, {});
    if (scene && scene.inputRevision === submitted.inputRevision) {
      await prisma.videoScene.update({
        where: { id: job.sceneId },
        data: job.provider === "runway"
          ? { generatedVideoUrl: result.outputUrl, status: "video_ready", videoRevision: scene.inputRevision }
          : { lipSyncVideoUrl: result.outputUrl, status: "ready", lipSyncRevision: scene.inputRevision },
      });
    }
  }
  return updated;
}

export async function cancelVideoJob(jobId: string) {
  const job = await prisma.videoJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error("Không tìm thấy job");
  if (!["queued", "processing"].includes(job.status)) return job;
  if (job.provider === "internal") {
    return prisma.videoJob.update({ where: { id: jobId }, data: {
      status: "cancelled", cancelRequested: true, error: "Người dùng hủy", completedAt: new Date(),
      nextPollAt: null, leaseOwner: null, leaseUntil: null,
    } });
  }
  return finishJob(jobId, { status: "cancelled", error: "Người dùng hủy" });
}

export async function runProjectQuality(projectId: string) {
  const project = await prisma.videoProject.findUnique({ where: { id: projectId }, include: { scenes: true } });
  if (!project) throw new Error("Không tìm thấy dự án");
  const renderInspection = project.outputUrl && project.renderedRevision === project.inputRevision
    ? await inspectRenderedVideo(project.outputUrl)
    : null;
  const report = evaluateProjectQuality({ ...project, renderInspection });
  await prisma.videoProject.update({ where: { id: projectId }, data: { qualityScore: report.score, qualityReport: JSON.stringify(report), status: report.passed ? "review" : project.status } });
  return report;
}
