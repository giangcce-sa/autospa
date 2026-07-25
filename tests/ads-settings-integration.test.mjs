import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("canonical Ads Settings is owner-only and performs one shared write", async () => {
  const route = await source("src/app/api/settings/ads/route.ts");
  const service = await source("src/lib/settings/ads.ts");

  assert.match(route, /requireUser\(\{ owner: true \}\)/);
  assert.match(route, /saveAdsSettings\(/);
  assert.equal(route.includes("prisma.settings"), false);
  assert.match(service, /parseCanonicalAdsSettingsRequest/);
  assert.match(service, /assertAdsThresholdOrder/);
  assert.equal(service.match(/persistSettingsPatch\(/g)?.length, 1);
});

test("Ads Settings reads deployment safety but only persists optimizer fields", async () => {
  const service = await source("src/lib/settings/ads.ts");
  const policy = await source("src/lib/settings/ads-policy.ts");

  for (const symbol of ["getAdsExecutionMode", "getEffectiveAdsAutomationLevel", "shouldForceAdsDryRun"]) {
    assert.match(service, new RegExp(symbol));
  }
  for (const env of ["ADS_EMERGENCY_STOP", "ADS_ALLOWED_FACEBOOK_PAGE_IDS", "ADS_ALLOWED_AD_ACCOUNT_IDS"]) {
    assert.match(service, new RegExp(env));
  }
  assert.equal(policy.includes("executionMode: z."), false);
  assert.equal(policy.includes("emergencyStop: z."), false);
  assert.equal(policy.includes("allowedFacebookPageIds: z."), false);
});

test("legacy Settings and canonical Ads reuse the same policy and field UI", async () => {
  const legacyRoute = await source("src/app/api/settings/route.ts");
  const legacyForm = await source("src/components/modules/settings/SettingsForm.tsx");
  const canonicalForm = await source("src/components/modules/settings/AdsSettingsForm.tsx");

  assert.match(legacyRoute, /parseAdsSettingsPatch\(body\)/);
  assert.match(legacyRoute, /assertAdsThresholdOrder/);
  assert.equal(legacyRoute.includes("boundedNumber(body.adsOptimize"), false);
  assert.match(legacyForm, /<AdsOptimizationFields/);
  assert.match(canonicalForm, /<AdsOptimizationFields/);
  assert.match(canonicalForm, /fetch\("\/api\/settings\/ads"/);
});

test("canonical Settings server-loads Ads and keeps safety state read-only", async () => {
  const workspace = await source("src/components/modules/settings/SettingsWorkspace.tsx");
  const form = await source("src/components/modules/settings/AdsSettingsForm.tsx");

  assert.match(workspace, /currentView\.id === "ads" \? await getAdsSettings\(\) : null/);
  assert.match(workspace, /<AdsSettingsForm initialSettings=\{adsSettings\}/);
  assert.equal(workspace.includes("fetch("), false);
  assert.match(form, /Database không thể tắt emergency stop/);
  assert.match(form, /Resource Ads mới vẫn luôn được tạo ở trạng thái PAUSED/);
  assert.equal(form.includes("setStatus((current) => ({ ...current, emergencyStop"), false);
});
