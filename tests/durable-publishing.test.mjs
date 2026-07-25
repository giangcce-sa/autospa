import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("publishing schema persists operations, channel attempts, leases, and convergence keys", async () => {
  const schema = await source("prisma/schema.prisma");
  const migration = await source("prisma/migrations/20260724223000_durable_publishing/migration.sql");
  const operation = schema.slice(schema.indexOf("model PublishOperation"), schema.indexOf("model ContentGeneration"));

  assert.match(operation, /idempotencyKey\s+String\s+@unique/);
  assert.match(operation, /requestHash\s+String/);
  assert.match(operation, /leaseOwner\s+String\?/);
  assert.match(operation, /leaseUntil\s+DateTime\?/);
  assert.match(operation, /reconciliationAt\s+DateTime\?/);
  assert.match(operation, /@@unique\(\[postId, requestHash\]\)/);
  assert.match(operation, /@@unique\(\[operationId, channel, attempt\]\)/);
  assert.match(migration, /PublishOperation_postId_requestHash_key/);
  assert.match(migration, /ON DELETE RESTRICT/);
  assert.match(migration, /ON DELETE CASCADE/);
});

test("one publishing service owns provider calls and durable retry semantics", async () => {
  const service = await source("src/lib/publishing/service.ts");

  assert.match(service, /publishRequestHash/);
  assert.match(service, /Idempotency key đã được dùng cho một yêu cầu publish khác/);
  assert.match(service, /publishOperation\.updateMany/);
  assert.match(service, /leaseUntil: new Date\(Date\.now\(\) \+ 15 \* 60_000\)/);
  assert.match(service, /status: "running", startedAt: new Date\(\)/);
  assert.match(service, /providerCheckpoint/);
  assert.match(service, /status: "needs_reconciliation"/);
  assert.match(service, /if \(previous\?\.status === "succeeded" \|\| previous\?\.status === "needs_reconciliation"\) return previous/);
  assert.match(service, /postToFacebook/);
  assert.match(service, /postToInstagram/);
  assert.match(service, /postPhotoToTikTok/);
  assert.match(service, /postVideoToFacebook/);
  assert.match(service, /postVideoToInstagram/);
  assert.match(service, /postVideoToTikTok/);
  assert.match(service, /postToZalo/);
});

test("manual, cron, and Video publishing delegate the shared service", async () => {
  const manual = await source("src/app/api/publish/route.ts");
  const cron = await source("src/app/api/cron/auto-publish/route.ts");
  const video = await source("src/lib/video-studio/publisher.ts");

  for (const entry of [manual, cron, video]) {
    assert.match(entry, /executePublishOperation/);
    assert.equal(entry.includes("postToFacebook("), false);
    assert.equal(entry.includes("postToInstagram("), false);
    assert.equal(entry.includes("postPhotoToTikTok("), false);
    assert.equal(entry.includes("postVideoToFacebook("), false);
    assert.equal(entry.includes("postVideoToInstagram("), false);
    assert.equal(entry.includes("postVideoToTikTok("), false);
  }
  assert.match(cron, /scheduled:\$\{post\.id\}:\$\{post\.updatedAt\.toISOString\(\)\}/);
  assert.match(video, /video:\$\{project\.id\}:\$\{input\.revision\}:\$\{targets\.join\(","\)\}/);
  assert.ok(video.indexOf("assertProjectPublishConsent(project.id)") < video.indexOf("executePublishOperation({"));
  assert.match(video, /publishedPostId: created\.id/);
});

test("publishing UI persists one client key and reloads per-channel operation state", async () => {
  const manager = await source("src/components/modules/publish/PublishManager.tsx");
  const workspace = await source("src/components/modules/creative/CreativeWorkspace.tsx");
  const route = await source("src/app/api/publish/route.ts");

  assert.match(manager, /publishRequestRef/);
  assert.match(manager, /crypto\.randomUUID\(\)/);
  assert.match(manager, /idempotencyKey: action === "publish-now" \? publishRequestRef\.current\?\.key/);
  assert.match(manager, /publishOperation\.channelAttempts\.map/);
  assert.match(manager, /Cần đối soát trước khi thử lại/);
  assert.match(route, /publishOperations:/);
  assert.match(route, /latestPublishChannelAttempts/);
  assert.match(route, /actorId: user\.id \?\? null/);
  assert.equal(route.includes("providerCheckpoint: true"), false);
  assert.equal(route.includes("leaseOwner: true"), false);
  assert.match(workspace, /publishOperations:/);
  assert.match(workspace, /latestPublishChannelAttempts/);
});

test("reconciliation cron never calls a provider or blindly retries ambiguous channels", async () => {
  const route = await source("src/app/api/cron/publish-reconcile/route.ts");
  const service = await source("src/lib/publishing/service.ts");
  const vercel = await source("vercel.json");
  const reconcile = service.slice(service.indexOf("export async function reconcileExpiredPublishOperations"));

  assert.match(route, /verifyCronAuth\(req\)/);
  assert.match(route, /reconcileExpiredPublishOperations\(\)/);
  assert.match(vercel, /\/api\/cron\/publish-reconcile/);
  assert.equal(reconcile.includes("postToFacebook("), false);
  assert.equal(reconcile.includes("postToInstagram("), false);
  assert.equal(reconcile.includes("postPhotoToTikTok("), false);
  assert.match(reconcile, /status: "needs_reconciliation"/);
  assert.match(reconcile, /status: "pending"/);
});
