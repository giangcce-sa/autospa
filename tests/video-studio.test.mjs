import test from "node:test";
import assert from "node:assert/strict";
import { evaluateProjectQuality } from "../src/lib/video-studio/quality.ts";
import { sceneInvalidationFor } from "../src/lib/video-studio/invalidation.ts";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const readyTalkingScene = {
  id: "scene-1", kind: "talking", script: "Xin chào", durationSec: 5,
  generatedVideoUrl: "https://example.com/scene.mp4", lipSyncVideoUrl: "https://example.com/sync.mp4",
  audioUrl: "https://example.com/voice.mp3", subtitleData: "[]", qaScore: 86,
  inputRevision: 2, videoRevision: 2, audioRevision: 2, lipSyncRevision: 2,
};

test("video QA passes a complete talking scene", () => {
  const report = evaluateProjectQuality({ durationSec: 5, aspectRatio: "9:16", approvalStatus: "pending", outputUrl: null, inputRevision: 2, scenes: [readyTalkingScene] });
  assert.equal(report.passed, true);
  assert.ok(report.score >= 75);
});

test("video QA blocks talking scenes without consent outputs", () => {
  const report = evaluateProjectQuality({ durationSec: 5, aspectRatio: "9:16", approvalStatus: "draft", outputUrl: null, inputRevision: 2, scenes: [{ ...readyTalkingScene, audioUrl: null, lipSyncVideoUrl: null }] });
  assert.equal(report.passed, false);
  assert.ok(report.issues.some((issue) => issue.code === "MISSING_VOICE"));
  assert.ok(report.issues.some((issue) => issue.code === "MISSING_LIPSYNC"));
});

test("video QA catches storyboard duration drift", () => {
  const report = evaluateProjectQuality({ durationSec: 30, aspectRatio: "9:16", approvalStatus: "draft", outputUrl: null, inputRevision: 2, scenes: [readyTalkingScene] });
  assert.ok(report.issues.some((issue) => issue.code === "DURATION_MISMATCH"));
});

test("video QA blocks a malformed rendered file", () => {
  const report = evaluateProjectQuality({
    durationSec: 5, aspectRatio: "9:16", approvalStatus: "pending", outputUrl: "/api/media/render.mp4",
    inputRevision: 2, renderedRevision: 2, scenes: [readyTalkingScene],
    renderInspection: { durationSec: 9, width: 1280, height: 720, hasAudio: false },
  });
  assert.equal(report.passed, false);
  assert.ok(report.issues.some((issue) => issue.code === "OUTPUT_RATIO_INVALID"));
  assert.ok(report.issues.some((issue) => issue.code === "OUTPUT_AUDIO_MISSING"));
});

test("scene script changes invalidate voice and lip-sync only", () => {
  const result = sceneInvalidationFor(["script"]);
  assert.equal(result.clearVideo, false);
  assert.equal(result.clearAudio, true);
  assert.equal(result.clearLipSync, true);
  assert.equal(result.invalidatesProject, true);
});

test("scene visual changes invalidate video and lip-sync", () => {
  const result = sceneInvalidationFor(["visualPrompt"]);
  assert.equal(result.clearVideo, true);
  assert.equal(result.clearAudio, false);
  assert.equal(result.clearLipSync, true);
});

test("Video Job GET returns persisted safe status without polling providers", async () => {
  const route = await source("src/app/api/video-studio/jobs/[id]/route.ts");
  const cron = await source("src/app/api/cron/video-jobs/route.ts");
  const studio = await source("src/components/modules/video-studio/VideoStudio.tsx");
  const getStart = route.indexOf("export async function GET");
  const deleteStart = route.indexOf("export async function DELETE");
  const get = route.slice(getStart, deleteStart);

  assert.match(get, /videoJob\.findUnique\(\{ where: \{ id \}, select: safeJobSelect \}\)/);
  assert.match(get, /requirePageAccess\(job\.project\.facebookPageId\)/);
  assert.equal(get.includes("pollVideoJob"), false);
  assert.equal(route.includes('import { cancelVideoJob, pollVideoJob }'), false);
  assert.match(route, /id: true,[\s\S]*?updatedAt: true/);
  assert.equal(route.includes("externalId: true"), false);
  assert.equal(route.includes("input: true"), false);
  assert.equal(route.includes("output: true"), false);
  assert.equal(route.includes("leaseUntil: true"), false);
  assert.equal(route.includes("actualCostUsd: true"), false);
  assert.match(cron, /pollVideoJob\(job\.id\)/);
  assert.match(studio, /`refresh-\$\{job\.id\}`/);
  assert.equal(studio.includes('`poll-${job.id}`'), false);
});
