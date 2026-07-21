import assert from "node:assert/strict";
import test from "node:test";
import { adsCreateRequestHash, assertAdsCreateRequestMatches } from "../src/lib/ads-create-policy.ts";

test("produces a stable hash for the same Ads create request", () => {
  const request = {
    postId: "post-1",
    facebookPageId: "page-1",
    adAccountId: "123",
    dailyBudgetVnd: 100000,
  };
  assert.equal(adsCreateRequestHash(request), adsCreateRequestHash({ ...request }));
});

test("rejects reuse of an idempotency key with a different Ads request", () => {
  const original = adsCreateRequestHash({ postId: "post-1", dailyBudgetVnd: 100000 });
  const changed = adsCreateRequestHash({ postId: "post-1", dailyBudgetVnd: 200000 });

  assert.throws(
    () => assertAdsCreateRequestMatches(original, changed),
    /Idempotency key/,
  );
});
