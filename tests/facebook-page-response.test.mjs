import assert from "node:assert/strict";
import test from "node:test";
import { safeFacebookPage } from "../src/lib/facebook-page-response.ts";

function pageFixture(overrides = {}) {
  return {
    id: "page-db-1",
    fbPageId: "meta-page-1",
    pageName: "AutoSpa",
    accessToken: "EAA-super-secret-token",
    isActive: true,
    adAccountId: "123",
    createdAt: new Date("2026-07-21T00:00:00.000Z"),
    adsReadinessStatus: "ready",
    adsReadinessError: null,
    adsReadinessCheckedAt: new Date("2026-07-21T01:00:00.000Z"),
    adsTokenExpiresAt: null,
    adsDataAccessExpiresAt: null,
    adsPermissions: '["ads_read","ads_management"]',
    adsMissingPermissions: "[]",
    adAccountStatus: 1,
    adAccountDisableReason: 0,
    adAccountCurrency: "VND",
    adAccountTimezone: "Asia/Ho_Chi_Minh",
    ...overrides,
  };
}

test("serializes Facebook Pages without exposing the raw access token", () => {
  const safe = safeFacebookPage(pageFixture());
  const serialized = JSON.stringify(safe);
  assert.equal(Object.hasOwn(safe, "accessToken"), false);
  assert.equal(serialized.includes("EAA-super-secret-token"), false);
  assert.equal(safe.accessTokenHint, "••••••••oken");
});

test("encrypted-at-rest tokens get a fixed hint instead of a ciphertext suffix", () => {
  const safe = safeFacebookPage(pageFixture({ accessToken: "enc:v2:aWl2:dGFn:Y2lwaGVydGV4dA" }));
  assert.equal(safe.accessTokenHint, "••••••••");
  assert.equal(JSON.stringify(safe).includes("enc:v2"), false);
});

test("returns structured readiness and tolerates malformed stored permission JSON", () => {
  const safe = safeFacebookPage(pageFixture({ adsPermissions: "invalid", adsMissingPermissions: '["ads_management",7]' }));
  assert.deepEqual(safe.adsReadiness.permissions, []);
  assert.deepEqual(safe.adsReadiness.missingPermissions, ["ads_management"]);
  assert.equal(safe.adsReadiness.currency, "VND");
});
