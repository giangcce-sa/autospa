import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAdCreativeFallback,
  parseAdCreativeRequest,
  parseGeneratedAdSpecText,
} from "../src/lib/ads-creative-policy.ts";

const validSpec = {
  captions: [{ text: "Một caption hợp lệ", hashtags: "#spa", tone: "friendly" }],
  audience: { ageMin: 25, ageMax: 45, gender: "female", locations: ["TP.HCM"], interests: ["spa"] },
  dailyBudget: 200_000,
  durationDays: 7,
  predictedCtr: 1.5,
  predictedRoas: 2,
};

test("Ads Creative request requires a strict Facebook Page scoped contract", () => {
  assert.deepEqual(parseAdCreativeRequest({ facebookPageId: "page-1" }), {
    facebookPageId: "page-1",
    objective: "conversions",
  });
  assert.throws(() => parseAdCreativeRequest({ objective: "reach" }));
  assert.throws(() => parseAdCreativeRequest({ facebookPageId: "page-1", dailyBudget: 19_999 }));
  assert.throws(() => parseAdCreativeRequest({ facebookPageId: "page-1", unknown: true }));
});

test("Ads Creative structured output rejects malformed and implausible values", () => {
  assert.deepEqual(parseGeneratedAdSpecText(JSON.stringify(validSpec)), validSpec);
  assert.equal(parseGeneratedAdSpecText("not json"), null);
  assert.equal(parseGeneratedAdSpecText(JSON.stringify({ ...validSpec, audience: { ...validSpec.audience, ageMin: 50, ageMax: 30 } })), null);
  assert.equal(parseGeneratedAdSpecText(JSON.stringify({ ...validSpec, predictedRoas: 100 })), null);
});

test("Ads Creative fallback is deterministic and conservative", () => {
  const fallback = buildAdCreativeFallback({ serviceName: "Chăm sóc da", dailyBudget: 300_000 });
  assert.equal(fallback.dailyBudget, 300_000);
  assert.equal(fallback.predictedCtr, 1.5);
  assert.equal(fallback.predictedRoas, 1.8);
  assert.match(fallback.captions[0].text, /Chăm sóc da/);
});
