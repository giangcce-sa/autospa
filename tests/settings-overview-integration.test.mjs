import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("canonical Settings overview reuses safe domain readers concurrently", async () => {
  const service = await source("src/lib/settings/overview.ts");

  assert.match(service, /await Promise\.all\(\[/);
  for (const reader of [
    "getConnectionSettings()",
    "getChannelSettings()",
    "getProviderSettings()",
    "getImageSettings()",
    "getVideoSettings()",
    "getAdsSettings()",
    "getAutomationSettings()",
    "getDataSettings()",
  ]) assert.match(service, new RegExp(reader.replace(/[()]/g, "\\$&")));
  assert.equal(service.includes("prisma."), false);
  assert.equal(service.includes("fetch("), false);
  for (const secret of [
    "claudeApiKey",
    "openaiApiKey",
    "runwayApiKey",
    "elevenLabsApiKey",
    "syncLabsApiKey",
    "spaApiKey",
    "webhookVerifyToken",
  ]) assert.equal(service.includes(secret), false);
});

test("canonical Settings workspace server-loads Overview without internal HTTP", async () => {
  const workspace = await source("src/components/modules/settings/SettingsWorkspace.tsx");
  const overview = await source("src/components/modules/settings/SettingsOverview.tsx");

  assert.match(workspace, /currentView\.id === "overview" \? await getSettingsOverview\(\) : null/);
  assert.match(workspace, /<SettingsOverview data=\{overview\}/);
  assert.equal(workspace.includes("fetch("), false);
  assert.match(overview, /Nguồn:/);
  assert.match(overview, /không được mô tả là “đã test”/);
});

test("Settings overview keeps configuration links canonical and safety language explicit", async () => {
  const policy = await source("src/lib/settings/overview-policy.ts");

  assert.match(policy, /\/system\/settings\?view=\$\{id\}&scope=account/);
  assert.match(policy, /Emergency stop từ deployment đang bật/);
  assert.match(policy, /resource mới vẫn luôn được tạo PAUSED/);
  assert.equal(policy.includes("/settings?tab="), false);
});
