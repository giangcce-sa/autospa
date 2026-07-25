import assert from "node:assert/strict";
import test from "node:test";
import {
  googleReviewResourceName,
  requiresOwnerForTikTokPublish,
  safeGoogleAccountSelect,
  trustedTelegramBaseUrl,
} from "../src/lib/channel-security.ts";
import { deleteGbpReviewReply } from "../src/lib/google-business.ts";
import { getTikTokUser } from "../src/lib/tiktok.ts";

test("Google account DTO selection excludes OAuth credentials", () => {
  assert.equal(Object.hasOwn(safeGoogleAccountSelect, "accessToken"), false);
  assert.equal(Object.hasOwn(safeGoogleAccountSelect, "refreshToken"), false);
  assert.equal(safeGoogleAccountSelect.email, true);
  assert.equal(safeGoogleAccountSelect.locationId, true);
});

test("Telegram webhook origin ignores request origin when server configuration exists", () => {
  assert.equal(
    trustedTelegramBaseUrl({
      autospaBaseUrl: "https://autospa.example/path",
      authUrl: "https://auth.example",
      requestOrigin: "https://attacker.example",
      production: true,
    }),
    "https://autospa.example",
  );
});

test("Telegram webhook origin fails closed in production without server configuration", () => {
  assert.throws(
    () => trustedTelegramBaseUrl({ requestOrigin: "https://attacker.example", production: true }),
    /HTTPS công khai/,
  );
  assert.throws(
    () => trustedTelegramBaseUrl({ autospaBaseUrl: "http://autospa.example", production: true }),
    /HTTPS công khai/,
  );
  assert.throws(
    () => trustedTelegramBaseUrl({ autospaBaseUrl: "https://localhost", production: true }),
    /HTTPS công khai/,
  );
});

test("Telegram webhook origin rejects private and link-local addresses", () => {
  for (const value of [
    "https://127.0.0.1",
    "https://10.0.0.1",
    "https://169.254.169.254",
    "https://192.168.1.10",
    "https://[::1]",
    "https://[fd00::1]",
  ]) {
    assert.throws(
      () => trustedTelegramBaseUrl({ autospaBaseUrl: value, production: true }),
      /HTTPS công khai/,
      value,
    );
  }
});

test("Telegram webhook origin permits HTTPS request origin only outside production", () => {
  assert.equal(
    trustedTelegramBaseUrl({ requestOrigin: "https://dev-tunnel.example/path", production: false }),
    "https://dev-tunnel.example",
  );
});

test("Google review resource names preserve full names and expand bare IDs", () => {
  const fullName = "accounts/1/locations/2/reviews/3";
  assert.equal(googleReviewResourceName("locations/2", fullName), fullName);
  assert.equal(googleReviewResourceName("locations/2/", "3"), "locations/2/reviews/3");
  assert.throws(() => googleReviewResourceName(null, "3"), /chưa chọn location/);
});

test("TikTok publishing requires an owner only for requested direct publishing", () => {
  assert.equal(requiresOwnerForTikTokPublish("publish-now", true), true);
  assert.equal(requiresOwnerForTikTokPublish("publish-now", false), false);
  assert.equal(requiresOwnerForTikTokPublish("draft", true), false);
  assert.equal(requiresOwnerForTikTokPublish("schedule", true), false);
});

test("TikTok user identity must match the access token", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  for (const providerOpenId of [undefined, "another-user"]) {
    globalThis.fetch = async () => Response.json({
      error: { code: "ok" },
      data: { user: { open_id: providerOpenId, display_name: "Test" } },
    });
    await assert.rejects(getTikTokUser("token", "expected-user"), /Open ID không khớp/);
  }

  globalThis.fetch = async () => Response.json({
    error: { code: "ok" },
    data: { user: { open_id: "expected-user", display_name: "Test" } },
  });
  const user = await getTikTokUser("token", "expected-user");
  assert.equal(user.openId, "expected-user");
});

test("Google delete reply rejects provider failures", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: "Forbidden" } }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });

  await assert.rejects(
    deleteGbpReviewReply("accounts/1/locations/2/reviews/3", "token"),
    /GBP delete reply: Forbidden/,
  );
});
