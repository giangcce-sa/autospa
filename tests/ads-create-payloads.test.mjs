import assert from "node:assert/strict";
import test from "node:test";
import { buildAdPayload, buildAdSetPayload, buildCampaignPayload } from "../src/lib/ads-create-payloads.ts";

test("keeps all deliverable Ads objects PAUSED", () => {
  assert.equal(buildCampaignPayload("Campaign", "OUTCOME_AWARENESS").status, "PAUSED");
  assert.equal(buildAdSetPayload({
    name: "AdSet",
    campaignId: "campaign-1",
    dailyBudgetVnd: 100000,
    targetCountry: "VN",
    targetAgeMin: 18,
    targetAgeMax: 55,
    targetGenders: [],
    objective: "OUTCOME_AWARENESS",
  }).status, "PAUSED");
  assert.equal(buildAdPayload("Ad", "adset-1", "creative-1").status, "PAUSED");
});

test("maps Awareness to the tested Reach and Impressions contract", () => {
  const payload = buildAdSetPayload({
    name: "AdSet",
    campaignId: "campaign-1",
    dailyBudgetVnd: 100000,
    targetCountry: "VN",
    targetAgeMin: 25,
    targetAgeMax: 45,
    targetGenders: [2],
    objective: "OUTCOME_AWARENESS",
  });
  assert.equal(payload.optimization_goal, "REACH");
  assert.equal(payload.billing_event, "IMPRESSIONS");
  assert.deepEqual(payload.targeting, {
    geo_locations: { countries: ["VN"] },
    age_min: 25,
    age_max: 45,
    genders: [2],
  });
});
