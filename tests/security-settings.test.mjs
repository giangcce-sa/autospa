import assert from "node:assert/strict";
import test from "node:test";
import { buildSecurityConfiguration } from "../src/lib/settings/security-policy.ts";

function input(overrides = {}) {
  return {
    databaseSecrets: {
      claude: false,
      openai: false,
      spaApi: false,
      spaWebhook: false,
      webhookVerify: false,
      zalo: false,
      telegram: false,
      runway: false,
      elevenLabs: false,
      sync: false,
    },
    deployment: {
      authSecret: false,
      cronSecret: false,
      publicBaseUrl: undefined,
      mediaStorageProvider: "local",
      mediaS3Bucket: false,
      runway: false,
      elevenLabs: false,
      sync: false,
    },
    ...overrides,
  };
}

function status(data, id) {
  const value = data.secrets.find((entry) => entry.id === id);
  assert.ok(value, `Missing secret status ${id}`);
  return value;
}

test("Security configuration exposes status and source without secret values", () => {
  const data = buildSecurityConfiguration(input({
    databaseSecrets: {
      ...input().databaseSecrets,
      claude: true,
      runway: true,
    },
    deployment: {
      ...input().deployment,
      authSecret: true,
      cronSecret: true,
      publicBaseUrl: "https://autospa.example.com",
      elevenLabs: true,
    },
  }));

  assert.equal(status(data, "auth").configured, true);
  assert.equal(status(data, "auth").source, "deployment");
  assert.equal(status(data, "claude").source, "database");
  assert.equal(status(data, "runway").source, "database");
  assert.equal(status(data, "elevenlabs").source, "deployment");
  assert.equal("value" in status(data, "claude"), false);
  assert.equal("suffix" in status(data, "claude"), false);
});

test("Security configuration reports production deployment blockers truthfully", () => {
  const data = buildSecurityConfiguration(input({
    deployment: {
      ...input().deployment,
      mediaStorageProvider: "s3",
      mediaS3Bucket: false,
      publicBaseUrl: "http://localhost:3000",
    },
  }));

  assert.deepEqual(data.deployment.map((entry) => [entry.id, entry.configured]), [
    ["auth-secret", false],
    ["cron-secret", false],
    ["public-origin", false],
    ["media-storage", false],
  ]);
  assert.match(data.deployment.find((entry) => entry.id === "auth-secret").detail, /AUTH_SECRET/);
  assert.match(data.deployment.find((entry) => entry.id === "cron-secret").detail, /CRON_SECRET/);
});

test("Security configuration accepts local storage but requires HTTPS public origin", () => {
  const data = buildSecurityConfiguration(input({
    deployment: {
      ...input().deployment,
      authSecret: true,
      cronSecret: true,
      publicBaseUrl: "https://autospa.example.com/path",
      mediaStorageProvider: "local",
    },
  }));

  assert.equal(data.deploymentReadyCount, 4);
  assert.equal(data.deployment.every((entry) => entry.configured), true);
});
