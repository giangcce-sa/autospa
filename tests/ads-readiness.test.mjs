import assert from "node:assert/strict";
import test from "node:test";
import {
  ADS_READINESS_MAX_AGE_MS,
  adsReadinessBlockReason,
} from "../src/lib/ads-readiness-policy.ts";

const now = new Date("2026-07-21T12:00:00.000Z");

function readySnapshot(overrides = {}) {
  return {
    adsReadinessStatus: "ready",
    adsReadinessError: null,
    adsReadinessCheckedAt: new Date(now.getTime() - 60_000),
    adAccountStatus: 1,
    adAccountCurrency: "VND",
    ...overrides,
  };
}

test("accepts a fresh active VND readiness snapshot", () => {
  assert.equal(adsReadinessBlockReason(readySnapshot(), now), null);
});

test("blocks unchecked and provider-blocked snapshots", () => {
  assert.equal(
    adsReadinessBlockReason(readySnapshot({ adsReadinessStatus: "unchecked" }), now),
    "Ad Account chưa vượt qua readiness check",
  );
  assert.equal(
    adsReadinessBlockReason(readySnapshot({ adsReadinessStatus: "blocked", adsReadinessError: "Thiếu quyền: ads_management" }), now),
    "Thiếu quyền: ads_management",
  );
});

test("blocks missing and stale readiness snapshots", () => {
  assert.match(
    adsReadinessBlockReason(readySnapshot({ adsReadinessCheckedAt: null }), now),
    /quá 24 giờ/,
  );
  assert.match(
    adsReadinessBlockReason(readySnapshot({
      adsReadinessCheckedAt: new Date(now.getTime() - ADS_READINESS_MAX_AGE_MS - 1),
    }), now),
    /quá 24 giờ/,
  );
});

test("blocks disabled and non-VND Ad Accounts", () => {
  assert.match(
    adsReadinessBlockReason(readySnapshot({ adAccountStatus: 2 }), now),
    /không ở trạng thái hoạt động/,
  );
  assert.match(
    adsReadinessBlockReason(readySnapshot({ adAccountCurrency: "USD" }), now),
    /không dùng currency VND/,
  );
});
