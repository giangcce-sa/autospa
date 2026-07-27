// Source-text pins for the at-rest encryption rollout: every write site must
// encrypt, every consuming read site must decrypt. A missed site sends
// ciphertext to a provider (soft 401) — this test catches the regression early.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("crypto core stays pure and shimmed", async () => {
  const crypto = await source("src/lib/secrets-crypto.ts");
  assert.doesNotMatch(crypto, /import "server-only"/);
  assert.doesNotMatch(crypto, /from "(@\/lib\/db|\.\/db)"/);
  assert.match(crypto, /enc:v2/);

  const shim = await source("src/lib/video-studio/secrets.ts");
  assert.match(shim, /encryptSecret as encryptVideoSecret/);
  assert.match(shim, /decryptSecret as decryptVideoSecret/);
});

test("settings write chokepoint encrypts; out-of-chokepoint telegram write too", async () => {
  const persistence = await source("src/lib/settings/persistence.ts");
  assert.match(persistence, /encryptSettingsSecrets\(patch/);
  const telegramRoute = await source("src/app/api/telegram/route.ts");
  assert.match(telegramRoute, /telegramWebhookSecret: encryptSecret\(secret\)/);
});

test("settings secret consumers decrypt", async () => {
  for (const path of [
    "src/lib/claude.ts",
    "src/lib/openai.ts",
    "src/lib/zalo.ts",
    "src/lib/telegram.ts",
    "src/lib/spa-client.ts",
    "src/lib/image-vision.ts",
    "src/lib/video-studio/learning.ts",
  ]) {
    assert.match(await source(path), /decryptSecret\(/, `${path} must decrypt before use`);
  }
});

test("resolveSecretInput stored fallbacks are decrypted (ciphertext-as-credential guard)", async () => {
  for (const path of [
    "src/lib/settings/providers.ts",
    "src/lib/settings/connections.ts",
    "src/lib/settings/channels.ts",
    "src/app/api/settings/route.ts",
  ]) {
    const text = await source(path);
    const bad = /resolveSecretInput\([^,]+,\s*(?!decryptSecret\()[a-z]+[^)]*\)/i.test(
      text.replace(/resolveSecretInput\([^,]+,\s*decryptSecret\([^)]*\)\s*\)/g, "")
    );
    assert.equal(bad, false, `${path} has a resolveSecretInput fallback without decryptSecret`);
  }
});

test("webhook verify tokens compare timing-safe on decrypted values", async () => {
  const fb = await source("src/app/api/webhook/facebook/route.ts");
  assert.match(fb, /secureCompare\(token, verifyToken\)/);
  assert.doesNotMatch(fb, /token === settings\.webhookVerifyToken/);
  const zalo = await source("src/app/api/zalo/webhook/route.ts");
  assert.match(zalo, /secureCompare\(verifyToken, expected\)/);
  const telegram = await source("src/app/api/webhook/telegram/route.ts");
  assert.match(telegram, /secureCompare\(receivedSecret, webhookSecret\)/);
  const spa = await source("src/app/api/spa/route.ts");
  assert.match(spa, /decryptSecret\(settings\?\.spaWebhookSecret\)/);
});

test("model-token write sites encrypt", async () => {
  for (const [path, pattern] of [
    ["src/app/api/facebook-pages/route.ts", /encryptSecret\(accessToken\.trim\(\)\)/],
    ["src/app/api/auth/tiktok/route.ts", /encryptSecret\(tokens\.accessToken\)/],
    ["src/app/api/tiktok/route.ts", /encryptSecret\(accessToken\)/],
    ["src/app/api/auth/google/route.ts", /encryptSecret\(tokens\.accessToken\)/],
    ["src/app/api/google-business/route.ts", /encryptSecret\(fresh\.accessToken\)/],
    ["src/app/api/cron/google-reviews/route.ts", /encryptSecret\(fresh\.accessToken\)/],
    ["src/app/api/competitors/route.ts", /encryptOptionalToken/],
  ]) {
    assert.match(await source(path), pattern, `${path} must encrypt on write`);
  }
});

test("model-token funnels decrypt", async () => {
  for (const path of [
    "src/lib/facebook.ts",
    "src/lib/facebook-ads.ts",
    "src/lib/ads-readiness.ts",
    "src/lib/publishing/service.ts",
    "src/lib/intelligence/ads-library.ts",
    "src/lib/competitor-research.ts",
    "src/lib/video-studio/performance-sync.ts",
    "src/app/api/instagram/route.ts",
    "src/app/api/style-training/route.ts",
    "src/app/api/google-business/route.ts",
    "src/app/api/cron/google-reviews/route.ts",
  ]) {
    assert.match(await source(path), /decryptSecret\(/, `${path} must decrypt tokens before use`);
  }
});

test("masking decrypts first so the owner sees a real suffix", async () => {
  const settingsRoute = await source("src/app/api/settings/route.ts");
  assert.match(settingsRoute, /maskSecret\(decryptSecret\(settings\.claudeApiKey\)\)/);
  const pageResponse = await source("src/lib/facebook-page-response.ts");
  assert.match(pageResponse, /isEncryptedSecret\(page\.accessToken\)/);
});
