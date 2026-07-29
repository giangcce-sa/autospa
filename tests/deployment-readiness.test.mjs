import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildDeploymentReadiness } from "../src/lib/deployment-readiness.ts";
import { resolveVideoExecutionPolicy } from "../src/lib/video-studio/execution-policy.ts";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Video execution defaults fail closed and Settings cannot exceed deployment", () => {
  assert.deepEqual(resolveVideoExecutionPolicy({ requestedMockMode: false }), {
    mode: "mock",
    mockMode: true,
    emergencyStop: true,
    liveAllowed: false,
    blocker: "Deployment chỉ cho phép chế độ mock",
  });
  assert.equal(resolveVideoExecutionPolicy({
    requestedMockMode: false,
    deploymentMode: "live",
    emergencyStop: "true",
  }).mockMode, true);
  assert.equal(resolveVideoExecutionPolicy({
    requestedMockMode: false,
    deploymentMode: "live",
    emergencyStop: "false",
  }).mockMode, false);
  assert.equal(resolveVideoExecutionPolicy({
    requestedMockMode: true,
    deploymentMode: "live",
    emergencyStop: "false",
  }).mockMode, true);
});

test("deployment readiness is redacted and requires only mandatory local dependencies", () => {
  const notReady = buildDeploymentReadiness({ database: false, env: {} });
  assert.equal(notReady.ready, false);
  assert.equal(notReady.safety.adsExecutionMode, "read_only");
  assert.equal(notReady.safety.adsEmergencyStop, true);
  assert.equal(notReady.safety.videoExecutionMode, "mock");
  assert.equal(notReady.safety.videoEmergencyStop, true);

  const ready = buildDeploymentReadiness({
    database: true,
    env: {
      AUTH_SECRET: "auth-value-must-not-leak",
      CRON_SECRET: "cron-value-must-not-leak",
      NEXT_PUBLIC_APP_URL: "https://autospa.example.com",
      DEPLOYMENT_MODE: "stateless",
      MEDIA_STORAGE_PROVIDER: "s3",
      MEDIA_S3_BUCKET: "media",
      APP_RELEASE: "sha-123",
      DEPLOYMENT_ENV: "staging",
      ADS_EXECUTION_MODE: "read_only",
      ADS_EMERGENCY_STOP: "true",
      VIDEO_EXECUTION_MODE: "live",
      VIDEO_EMERGENCY_STOP: "false",
      VIDEO_MOCK_MODE: "false",
    },
  });
  assert.equal(ready.ready, true);
  assert.equal(ready.release, "sha-123");
  assert.equal(ready.environment, "staging");
  assert.equal(ready.safety.videoExecutionMode, "live");
  assert.deepEqual(ready.deployment, { mode: "stateless", source: "explicit" });
  assert.deepEqual(ready.media, { provider: "s3", configured: true, durable: true });
  const serialized = JSON.stringify(ready);
  assert.equal(serialized.includes("auth-value-must-not-leak"), false);
  assert.equal(serialized.includes("cron-value-must-not-leak"), false);
});

test("deployment readiness fails closed on incomplete production release configuration", () => {
  const result = buildDeploymentReadiness({
    database: true,
    env: {
      DEPLOYMENT_ENV: "production",
      AUTH_SECRET: "change-me",
      CRON_SECRET: "change-me",
      AUTH_URL: "https://autospa.example.com",
      NEXT_PUBLIC_APP_URL: "https://autospa.example.com",
      DEPLOYMENT_MODE: "persistent",
      MEDIA_STORAGE_PROVIDER: "local",
    },
  });

  assert.equal(result.ready, false);
  assert.equal(result.checks.productionEnvironment, false);
  assert.equal(JSON.stringify(result).includes("change-me"), false);
});

test("deployment readiness blocks local media on stateless runtimes", () => {
  const result = buildDeploymentReadiness({
    database: true,
    env: {
      AUTH_SECRET: "auth",
      CRON_SECRET: "cron",
      NEXT_PUBLIC_APP_URL: "https://autospa.example.com",
      VERCEL: "1",
      MEDIA_STORAGE_PROVIDER: "local",
    },
  });

  assert.equal(result.ready, false);
  assert.equal(result.checks.mediaStorage, false);
  assert.deepEqual(result.deployment, { mode: "stateless", source: "vercel_fallback" });
});

test("health and readiness remain public, read-only and provider-free", async () => {
  const [proxy, health, ready, videoConfig, cronAuth] = await Promise.all([
    source("src/proxy.ts"),
    source("src/app/api/health/route.ts"),
    source("src/app/api/ready/route.ts"),
    source("src/lib/video-studio/config.ts"),
    source("src/lib/cron-auth.ts"),
  ]);
  assert.match(proxy, /"\/api\/health"/);
  assert.match(proxy, /"\/api\/ready"/);
  assert.equal(health.includes("prisma"), false);
  assert.match(ready, /prisma\.\$queryRaw`SELECT 1`/);
  assert.equal(ready.includes("fetch("), false);
  assert.match(videoConfig, /resolveVideoExecutionPolicy/);
  assert.match(cronAuth, /timingSafeEqual/);
});
