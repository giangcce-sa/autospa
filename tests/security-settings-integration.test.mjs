import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Security Settings uses a minimal server-only DTO and concurrent reads", async () => {
  const service = await source("src/lib/settings/security.ts");

  assert.match(service, /import "server-only"/);
  assert.match(service, /await Promise\.all\(\[/);
  assert.match(service, /where: \{ type: "settings_change" \}/);
  assert.match(service, /take: 12/);
  assert.equal(service.includes("metadata: true"), false);
  assert.equal(service.includes("hashedPwd: true"), false);
  assert.equal(service.includes("accessToken: true"), false);
  assert.equal(service.includes("fetch("), false);
  assert.match(service, /databaseSessionTracking: false/);
  assert.match(service, /strategy: "jwt"/);
});

test("canonical Settings server-loads Security and renders no mutation UI", async () => {
  const workspace = await source("src/components/modules/settings/SettingsWorkspace.tsx");
  const view = await source("src/components/modules/settings/SecuritySettingsView.tsx");

  assert.match(workspace, /currentView\.id === "security" \? await getSecuritySettings\(\) : null/);
  assert.match(workspace, /<SecuritySettingsView data=\{securitySettings\}/);
  assert.equal(workspace.includes("fetch("), false);
  assert.equal(view.includes("use client"), false);
  assert.equal(view.includes("fetch("), false);
  assert.equal(view.includes("<form"), false);
  assert.match(view, /không có bảng session/);
  assert.match(view, /không được truyền tới UI này/);
});

test("Security configuration never sends deployment values or secret payloads to UI", async () => {
  const service = await source("src/lib/settings/security.ts");
  const policy = await source("src/lib/settings/security-policy.ts");

  for (const name of ["AUTH_SECRET", "CRON_SECRET", "MEDIA_S3_BUCKET", "RUNWAY_API_KEY"]) {
    assert.match(service, new RegExp(`process\\.env\\.${name}`));
  }
  assert.equal(policy.includes("secretValue"), false);
  assert.equal(policy.includes("rawSecret"), false);
  assert.equal(policy.includes("process.env"), false);
  assert.match(policy, /configured: boolean/);
});
