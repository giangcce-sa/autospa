import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("canonical Video Settings is owner-only and delegates to the shared service", async () => {
  const route = await source("src/app/api/settings/video/route.ts");

  assert.match(route, /requireUser\(\{ owner: true \}\)/);
  assert.match(route, /saveVideoSettings\(/);
  assert.match(route, /testVideoProviderSettings\(/);
  assert.equal(route.includes("prisma.settings"), false);
  assert.equal(route.includes("encryptVideoSecret"), false);
});

test("Video Settings service owns validation, encryption and one shared write", async () => {
  const service = await source("src/lib/settings/video.ts");

  assert.match(service, /parseCanonicalVideoSettingsRequest/);
  assert.match(service, /assertSafeProviderBaseUrl/);
  assert.match(service, /sameProviderOrigin/);
  assert.match(service, /encryptVideoSecret/);
  assert.equal(service.match(/persistSettingsPatch\(/g)?.length, 1);
  assert.match(service, /current\?\.\[fields\.key\] \|\| fields\.deploymentKey/);
});

test("legacy Video config and provider tests use the canonical service", async () => {
  const configRoute = await source("src/app/api/video-studio/config/route.ts");
  const providersRoute = await source("src/app/api/video-studio/providers/route.ts");

  assert.match(configRoute, /saveVideoSettings\(/);
  assert.match(configRoute, /getVideoSettings\(/);
  assert.equal(configRoute.includes("prisma.settings"), false);
  assert.equal(configRoute.includes("encryptVideoSecret"), false);
  assert.match(providersRoute, /testVideoProviderSettings\(/);
  assert.equal(providersRoute.includes("providerFetch"), false);
});

test("canonical Settings server-loads Video and Video Studio only shows readiness", async () => {
  const workspace = await source("src/components/modules/settings/SettingsWorkspace.tsx");
  const studio = await source("src/components/modules/video-studio/VideoStudio.tsx");
  const form = await source("src/components/modules/settings/VideoSettingsForm.tsx");

  assert.match(workspace, /currentView\.id === "video" \? await getVideoSettings\(\) : null/);
  assert.match(workspace, /<VideoSettingsForm initialSettings=\{videoSettings\}/);
  assert.equal(workspace.includes("fetch("), false);
  assert.match(studio, /ProviderReadiness/);
  assert.match(studio, /\/system\/settings\?view=video&scope=account/);
  assert.equal(studio.includes("function ProviderSettings("), false);
  assert.equal(studio.includes('api<VideoConfig>("/api/video-studio/config")'), false);
  assert.match(form, /fetch\("\/api\/settings\/video"/);
});
