import assert from "node:assert/strict";
import test from "node:test";
import { ZodError } from "zod";
import {
  assertAdsThresholdOrder,
  parseAdsSettingsPatch,
  parseCanonicalAdsSettingsRequest,
  toAdsOptimizationSettings,
} from "../src/lib/settings/ads-policy.ts";

test("canonical Ads settings accept bounded typed optimization values", () => {
  assert.deepEqual(parseCanonicalAdsSettingsRequest({
    adsOptimizePauseCtr: 0.6,
    adsOptimizeScaleCtr: 2.5,
    adsOptimizeFreqLimit: 3.5,
    adsOptimizeScalePct: 25,
    adsOptimizeMinSpend: 150_000,
    adsOptimizeMaxBudget: 3_000_000,
    adsOptimizeCooldownHrs: 36,
    adsOptimizeMinRoas: 2,
  }), {
    adsOptimizePauseCtr: 0.6,
    adsOptimizeScaleCtr: 2.5,
    adsOptimizeFreqLimit: 3.5,
    adsOptimizeScalePct: 25,
    adsOptimizeMinSpend: 150_000,
    adsOptimizeMaxBudget: 3_000_000,
    adsOptimizeCooldownHrs: 36,
    adsOptimizeMinRoas: 2,
  });
});

test("canonical Ads settings reject unknown, empty, coerced and out-of-range values", () => {
  for (const input of [
    {},
    { automationLevel: "full" },
    { adsOptimizePauseCtr: "0.5" },
    { adsOptimizeScalePct: 51 },
    { adsOptimizeScalePct: 12.5 },
    { adsOptimizeMinSpend: 49_999 },
    { adsOptimizeMaxBudget: Number.NaN },
    { adsOptimizeCooldownHrs: 3 },
  ]) assert.throws(() => parseCanonicalAdsSettingsRequest(input), ZodError);
});

test("legacy Ads parser ignores non-Ads domains", () => {
  assert.deepEqual(parseAdsSettingsPatch({
    adsOptimizePauseCtr: 0.7,
    webhookMode: "auto",
    videoMockMode: false,
  }), { adsOptimizePauseCtr: 0.7 });
});

test("Ads threshold order validates effective values after a partial patch", () => {
  const current = toAdsOptimizationSettings({ adsOptimizePauseCtr: 0.5, adsOptimizeScaleCtr: 2 });
  assert.doesNotThrow(() => assertAdsThresholdOrder({ ...current, adsOptimizePauseCtr: 1.5 }));
  assert.throws(() => assertAdsThresholdOrder({ ...current, adsOptimizePauseCtr: 2 }), ZodError);
  assert.throws(() => assertAdsThresholdOrder({ ...current, adsOptimizeScaleCtr: 0.5 }), ZodError);
});

test("Ads optimization DTO defaults remain aligned with optimizer behavior", () => {
  assert.deepEqual(toAdsOptimizationSettings(null), {
    adsOptimizePauseCtr: 0.5,
    adsOptimizeScaleCtr: 2,
    adsOptimizeFreqLimit: 3,
    adsOptimizeScalePct: 20,
    adsOptimizeMinSpend: 100_000,
    adsOptimizeMaxBudget: 2_000_000,
    adsOptimizeCooldownHrs: 24,
    adsOptimizeMinRoas: 1.5,
  });
});
