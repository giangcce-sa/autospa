import assert from "node:assert/strict";
import test from "node:test";
import { runAdsCreateWorkflow } from "../src/lib/ads-create-workflow.ts";

function createHarness(initialState = {}, failAt) {
  const state = { ...initialState };
  const calls = [];
  const checkpoints = [];
  const step = async (name, value) => {
    calls.push(name);
    if (failAt === name) throw new Error(`failed:${name}`);
    return value;
  };
  return {
    state,
    calls,
    checkpoints,
    input: {
      state,
      requiresImage: true,
      createCampaign: () => step("campaign", "campaign-1"),
      createAdSet: (campaignId) => {
        assert.equal(campaignId, "campaign-1");
        return step("adset", "adset-1");
      },
      uploadImage: () => step("image", "image-hash-1"),
      createCreative: (imageHash) => {
        assert.equal(imageHash, "image-hash-1");
        return step("creative", "creative-1");
      },
      createAd: (adSetId, creativeId) => {
        assert.equal(adSetId, "adset-1");
        assert.equal(creativeId, "creative-1");
        return step("ad", "ad-1");
      },
      checkpoint: async (field, value, nextStep) => {
        state[field] = value;
        checkpoints.push({ field, value, nextStep });
      },
    },
  };
}

test("creates and checkpoints each PAUSED Ads resource in dependency order", async () => {
  const harness = createHarness();
  const result = await runAdsCreateWorkflow(harness.input);

  assert.deepEqual(harness.calls, ["campaign", "adset", "image", "creative", "ad"]);
  assert.deepEqual(harness.checkpoints.map((item) => item.nextStep), [
    "adset",
    "image",
    "creative",
    "ad",
    "complete",
  ]);
  assert.deepEqual(result, {
    campaignId: "campaign-1",
    adSetId: "adset-1",
    imageHash: "image-hash-1",
    creativeId: "creative-1",
    adId: "ad-1",
  });
});

test("resumes after a partial provider failure without recreating checkpointed resources", async () => {
  const first = createHarness({}, "creative");
  await assert.rejects(() => runAdsCreateWorkflow(first.input), /failed:creative/);
  assert.deepEqual(first.calls, ["campaign", "adset", "image", "creative"]);
  assert.deepEqual(first.state, {
    campaignId: "campaign-1",
    adSetId: "adset-1",
    imageHash: "image-hash-1",
  });

  const retry = createHarness(first.state);
  const result = await runAdsCreateWorkflow(retry.input);
  assert.deepEqual(retry.calls, ["creative", "ad"]);
  assert.equal(result.campaignId, "campaign-1");
  assert.equal(result.adId, "ad-1");
});

test("replays a completed operation without calling provider steps", async () => {
  const harness = createHarness({
    campaignId: "campaign-1",
    adSetId: "adset-1",
    imageHash: "image-hash-1",
    creativeId: "creative-1",
    adId: "ad-1",
  });

  const result = await runAdsCreateWorkflow(harness.input);
  assert.deepEqual(harness.calls, []);
  assert.deepEqual(harness.checkpoints, []);
  assert.equal(result.adId, "ad-1");
});
