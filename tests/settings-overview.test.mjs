import assert from "node:assert/strict";
import test from "node:test";
import { buildSettingsOverview } from "../src/lib/settings/overview-policy.ts";

function input(overrides = {}) {
  return {
    connections: { hasUrl: true, hasApiKey: true, hasWebhookSecret: true },
    channels: { connected: 2, total: 6 },
    providers: { claude: true, openai: false },
    images: { model: "dall-e-3", storageProvider: "local", storageConfigured: true },
    video: { mockMode: true, runway: false, elevenLabs: false, sync: false, deploymentKeyCount: 0 },
    ads: {
      executionMode: "read_only",
      emergencyStop: true,
      forcedDryRun: true,
      allowedPageCount: 0,
      allowedAdAccountCount: 0,
    },
    automation: { webhookMode: "manual", hasWebhookVerifyToken: false, automationLevel: "supervised" },
    data: { draftRetentionDays: 30, publishedRetentionDays: 90 },
    ...overrides,
  };
}

function domain(data, id) {
  const value = data.items.find((entry) => entry.id === id);
  assert.ok(value, `Missing overview domain ${id}`);
  return value;
}

test("Settings overview reports truthful configuration readiness and stable deep links", () => {
  const data = buildSettingsOverview(input());

  assert.equal(data.items.length, 8);
  assert.equal(domain(data, "connections").status, "ready");
  assert.equal(domain(data, "channels").status, "ready");
  assert.equal(domain(data, "providers").status, "ready");
  assert.equal(domain(data, "images").status, "ready");
  assert.equal(domain(data, "video").status, "attention");
  assert.equal(domain(data, "ads").status, "blocked");
  assert.equal(domain(data, "automation").status, "info");
  assert.equal(domain(data, "data").status, "info");
  assert.equal(domain(data, "ads").href, "/system/settings?view=ads&scope=account");
  assert.equal(data.readyCount + data.attentionCount + data.blockedCount + data.infoCount, data.items.length);
});

test("Settings overview applies deployment Ads blockers in safety order", () => {
  const emergency = buildSettingsOverview(input({
    ads: {
      executionMode: "full",
      emergencyStop: true,
      forcedDryRun: true,
      allowedPageCount: 1,
      allowedAdAccountCount: 1,
    },
  }));
  assert.equal(domain(emergency, "ads").statusLabel, "Emergency stop");

  const readOnly = buildSettingsOverview(input({
    ads: {
      executionMode: "read_only",
      emergencyStop: false,
      forcedDryRun: true,
      allowedPageCount: 1,
      allowedAdAccountCount: 1,
    },
  }));
  assert.equal(domain(readOnly, "ads").statusLabel, "Chỉ đọc");

  const missingAllowlist = buildSettingsOverview(input({
    ads: {
      executionMode: "semi",
      emergencyStop: false,
      forcedDryRun: false,
      allowedPageCount: 1,
      allowedAdAccountCount: 0,
    },
  }));
  assert.equal(domain(missingAllowlist, "ads").statusLabel, "Thiếu allowlist");

  const ready = buildSettingsOverview(input({
    ads: {
      executionMode: "full",
      emergencyStop: false,
      forcedDryRun: false,
      allowedPageCount: 1,
      allowedAdAccountCount: 1,
    },
  }));
  assert.equal(domain(ready, "ads").status, "ready");
  assert.match(domain(ready, "ads").detail, /PAUSED/);
});

test("Settings overview distinguishes safe video mock mode from incomplete live mode", () => {
  const mock = buildSettingsOverview(input());
  assert.equal(domain(mock, "video").status, "attention");
  assert.equal(domain(mock, "video").statusLabel, "Đang mô phỏng");

  const incompleteLive = buildSettingsOverview(input({
    video: { mockMode: false, runway: true, elevenLabs: false, sync: false, deploymentKeyCount: 1 },
  }));
  assert.equal(domain(incompleteLive, "video").status, "blocked");
  assert.equal(domain(incompleteLive, "video").source, "Database + deployment");

  const live = buildSettingsOverview(input({
    video: { mockMode: false, runway: true, elevenLabs: true, sync: true, deploymentKeyCount: 0 },
  }));
  assert.equal(domain(live, "video").status, "ready");
});

test("Settings overview blocks broken media storage and unsafe automatic webhook", () => {
  const data = buildSettingsOverview(input({
    images: { model: "dall-e-3", storageProvider: "s3", storageConfigured: false },
    automation: { webhookMode: "auto", hasWebhookVerifyToken: false, automationLevel: "full" },
  }));

  assert.equal(domain(data, "images").status, "blocked");
  assert.equal(domain(data, "images").source, "Deployment");
  assert.equal(domain(data, "automation").status, "blocked");
  assert.equal(domain(data, "automation").statusLabel, "Thiếu verify token");
});
