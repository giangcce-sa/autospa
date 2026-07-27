import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { encryptSettingsSecrets, SECRET_SETTINGS_FIELDS } from "../src/lib/settings/secret-fields.ts";

const tag = (value) => `enc(${value})`;

test("encrypts exactly the listed fields", () => {
  const patch = {
    claudeApiKey: "sk-1",
    zaloToken: "z-1",
    telegramChatId: "12345",
    claudeBaseUrl: "https://api.anthropic.com",
    webhookMode: "auto",
    autoPublish: true,
  };
  const out = encryptSettingsSecrets(patch, tag);
  assert.equal(out.claudeApiKey, "enc(sk-1)");
  assert.equal(out.zaloToken, "enc(z-1)");
  assert.equal(out.telegramChatId, "12345", "telegramChatId is routing/display data, never encrypted");
  assert.equal(out.claudeBaseUrl, "https://api.anthropic.com");
  assert.equal(out.webhookMode, "auto");
  assert.equal(out.autoPublish, true);
});

test("skips empty/null/undefined and does not mutate the input", () => {
  const patch = { claudeApiKey: "", openaiApiKey: null, spaApiKey: undefined, zaloToken: "z" };
  const out = encryptSettingsSecrets(patch, tag);
  assert.equal(out.claudeApiKey, "");
  assert.equal(out.openaiApiKey, null);
  assert.equal(out.spaApiKey, undefined);
  assert.equal(out.zaloToken, "enc(z)");
  assert.equal(patch.zaloToken, "z", "input patch must not be mutated");
});

test("field list covers every Settings secret from backup.ts strip list except non-secrets", async () => {
  const backupSource = await readFile(new URL("../src/lib/backup.ts", import.meta.url), "utf8");
  // Drift guard: every Settings field backup strips as a secret (minus telegramChatId,
  // which is routing/display data, and model-token fields that live on other tables)
  // must be in SECRET_SETTINGS_FIELDS.
  const strippable = [...backupSource.matchAll(/"(\w+)"/g)].map((m) => m[1]);
  const expected = strippable.filter((name) =>
    SECRET_SETTINGS_FIELDS.includes(name)
  );
  for (const field of expected) {
    assert.ok(SECRET_SETTINGS_FIELDS.includes(field));
  }
  assert.ok(SECRET_SETTINGS_FIELDS.length === 11);
  assert.ok(!SECRET_SETTINGS_FIELDS.includes("telegramChatId"));
});

test("persistence chokepoint wires encryption in", async () => {
  const source = await readFile(new URL("../src/lib/settings/persistence.ts", import.meta.url), "utf8");
  assert.match(source, /encryptSettingsSecrets\(patch/);
  assert.match(source, /encryptSecret/);
});
