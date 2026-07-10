import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAdsPolicy } from "../src/lib/ads-optimization-policy.ts";

const defaults = {
  pauseCtrPercent: 0.5,
  scaleCtrPercent: 2,
  scalePercent: 20,
  maxDailyBudget: 2_000_000,
  roas: 2,
  minRoas: 1.5,
};

test("treats Meta CTR as a percentage without dividing by 100", () => {
  assert.equal(evaluateAdsPolicy({ ...defaults, ctrPercent: 0.49, roas: 0 }).type, "pause");
  assert.equal(evaluateAdsPolicy({ ...defaults, ctrPercent: 1.5 }).type, "none");
  assert.equal(evaluateAdsPolicy({ ...defaults, ctrPercent: 2.01, currentBudget: 500_000 }).type, "scale");
});

test("caps a scale decision at the configured daily maximum", () => {
  assert.deepEqual(
    evaluateAdsPolicy({ ...defaults, ctrPercent: 3, currentBudget: 1_900_000 }),
    { type: "scale", nextBudget: 2_000_000, reason: "CTR trên ngưỡng 2%" },
  );
});

test("does not scale when a safe budget target is unavailable", () => {
  assert.deepEqual(
    evaluateAdsPolicy({ ...defaults, ctrPercent: 3, budgetIssue: "Nhiều Ad Set" }),
    { type: "skip", reason: "Nhiều Ad Set" },
  );
});

test("protects revenue-producing campaigns and requires ROAS before scaling", () => {
  assert.equal(evaluateAdsPolicy({ ...defaults, ctrPercent: 0.3, roas: 1.1 }).type, "skip");
  assert.equal(
    evaluateAdsPolicy({ ...defaults, ctrPercent: 3, currentBudget: 500_000, roas: 1.2 }).type,
    "skip",
  );
});
