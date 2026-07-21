import assert from "node:assert/strict";
import test from "node:test";
import {
  budgetTargetBelongsToCampaign,
  campaignBelongsToAdAccount,
} from "../src/lib/ads-ownership.ts";

test("binds a campaign to the configured Ad Account", () => {
  assert.equal(campaignBelongsToAdAccount({ id: "cmp-1", account_id: "123" }, "act_123"), true);
  assert.equal(campaignBelongsToAdAccount({ id: "cmp-1", account_id: "999" }, "123"), false);
  assert.equal(campaignBelongsToAdAccount({ account_id: "123" }, "123"), false);
});

test("requires a campaign budget target to equal the campaign ID", () => {
  assert.equal(budgetTargetBelongsToCampaign({
    campaignId: "cmp-1",
    targetId: "cmp-1",
    targetType: "campaign",
    adAccountId: "123",
  }), true);
  assert.equal(budgetTargetBelongsToCampaign({
    campaignId: "cmp-1",
    targetId: "cmp-2",
    targetType: "campaign",
    adAccountId: "123",
  }), false);
});

test("requires an Ad Set to belong to both campaign and Ad Account", () => {
  const base = {
    campaignId: "cmp-1",
    targetId: "set-1",
    targetType: "adset",
    adAccountId: "123",
  };
  assert.equal(budgetTargetBelongsToCampaign({
    ...base,
    adSet: { id: "set-1", campaign_id: "cmp-1", account_id: "act_123" },
  }), true);
  assert.equal(budgetTargetBelongsToCampaign({
    ...base,
    adSet: { id: "set-1", campaign_id: "cmp-2", account_id: "123" },
  }), false);
  assert.equal(budgetTargetBelongsToCampaign({
    ...base,
    adSet: { id: "set-1", campaign_id: "cmp-1", account_id: "999" },
  }), false);
});
