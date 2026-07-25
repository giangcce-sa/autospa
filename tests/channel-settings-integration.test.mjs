import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("canonical Channels server-loads safe data and locally dispatches the workspace", async () => {
  const workspace = await source("src/components/modules/settings/SettingsWorkspace.tsx");
  const service = await source("src/lib/settings/channels.ts");
  const registry = await source("src/config/routes.ts");

  assert.match(workspace, /currentView\.id === "channels" \? await getChannelSettings\(\) : null/);
  assert.match(workspace, /<ChannelSettingsView initialSettings=\{channelSettings\}/);
  assert.equal(workspace.includes("fetch("), false);
  assert.match(service, /Promise\.all\(\[/);
  assert.match(service, /safeFacebookPage/);
  assert.match(service, /safeGoogleAccountSelect/);
  assert.equal(registry.includes('{ id: "channels", label: "Kênh", description: "Facebook, Instagram, TikTok, Zalo, Google và Telegram.", targetPath: "/settings" }'), false);
});

test("canonical Zalo API and legacy Settings share one service and owner enforcement", async () => {
  const canonicalRoute = await source("src/app/api/settings/channels/route.ts");
  const legacyRoute = await source("src/app/api/settings/route.ts");
  const service = await source("src/lib/settings/channels.ts");

  assert.equal(canonicalRoute.match(/requireUser\(\{ owner: true \}\)/g)?.length, 3);
  assert.match(canonicalRoute, /saveZaloSettings/);
  assert.match(canonicalRoute, /testZaloSettings/);
  assert.match(legacyRoute, /parseZaloSettingsPatch\(body\)/);
  assert.match(legacyRoute, /testZaloSettings\(\{ zaloToken: apiKey \}\)/);
  assert.equal(legacyRoute.includes('["zaloToken", getSecretReplacement(zaloToken)]'), false);
  assert.equal(service.match(/persistSettingsPatch\(/g)?.length, 2);
});

test("Zalo publishing is owner-only and no longer exposes an unauthenticated connection probe", async () => {
  const route = await source("src/app/api/zalo/route.ts");

  assert.match(route, /await requireUser\(\{ owner: true \}\)/);
  assert.match(route, /accessErrorResponse\(error\)/);
  assert.match(route, /testZaloSettings\(\{ zaloToken: apiKey \}\)/);
});

test("legacy and canonical channel views reuse the same manager components", async () => {
  const legacy = await source("src/components/modules/settings/SettingsForm.tsx");
  const canonical = await source("src/components/modules/settings/ChannelSettingsView.tsx");
  const telegramRoute = await source("src/app/api/telegram/route.ts");

  for (const component of ["FacebookPageSettings", "ZaloSettingsForm", "InstagramSettings", "TikTokSettings", "GoogleBusinessSettings", "TelegramSettings"]) {
    assert.match(legacy, new RegExp(`<${component}`));
    assert.match(canonical, new RegExp(`<${component}`));
  }
  assert.match(telegramRoute, /saveTelegramSettings\(body,/);
  assert.match(telegramRoute, /getTelegramSettings\(\)/);
  assert.equal(telegramRoute.includes("prisma.settings.upsert"), false);
  assert.equal(legacy.includes("fbPages.map"), false);
});
