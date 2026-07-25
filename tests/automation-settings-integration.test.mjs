import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("canonical Automation route enforces owner access and one shared write", async () => {
  const route = await source("src/app/api/settings/automation/route.ts");

  assert.match(route, /requireUser\(\{ owner: true \}\)/);
  assert.equal(route.match(/persistSettingsPatch\(/g)?.length, 1);
  assert.equal(route.includes("adsOptimize"), false);
  assert.equal(route.includes("fetch("), false);
});

test("legacy Settings merges Automation and Ads before one shared write", async () => {
  const route = await source("src/app/api/settings/route.ts");

  assert.match(route, /Object\.assign\(updateData, parseAutomationSettingsPatch\(body\)\)/);
  assert.match(route, /const adsPatch = parseAdsSettingsPatch\(body\)/);
  assert.match(route, /Object\.assign\(updateData, adsPatch\)/);
  assert.equal(route.match(/persistSettingsPatch\(/g)?.length, 1);
});

test("canonical Settings workspace server-loads only the Automation view", async () => {
  const workspace = await source("src/components/modules/settings/SettingsWorkspace.tsx");
  const page = await source("src/app/system/settings/page.tsx");

  assert.match(workspace, /currentView\.id === "automation" \? await getAutomationSettings\(\) : null/);
  assert.equal(workspace.includes("fetch("), false);
  assert.match(page, /<SettingsWorkspace searchParams=\{searchParams\}/);
});
