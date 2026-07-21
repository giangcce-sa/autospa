import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateAdsMutation,
  getAdsExecutionMode,
  getEffectiveAdsAutomationLevel,
  shouldForceAdsDryRun,
} from "../src/lib/ads-safety.ts";

const allowedEnv = {
  ADS_EXECUTION_MODE: "full",
  ADS_EMERGENCY_STOP: "false",
  ADS_ALLOWED_FACEBOOK_PAGE_IDS: "page-1,page-2",
  ADS_ALLOWED_AD_ACCOUNT_IDS: "123,act_456",
};

test("defaults Ads execution to read-only and keeps the kill switch closed", () => {
  assert.equal(getAdsExecutionMode({}), "read_only");
  assert.equal(getAdsExecutionMode({ ADS_EXECUTION_MODE: "invalid" }), "read_only");
  assert.equal(shouldForceAdsDryRun({}), true);
  assert.equal(getEffectiveAdsAutomationLevel("full", {}), "supervised");
  assert.equal(evaluateAdsMutation({ operation: "pause_campaign", env: {} }).allowed, false);
});

test("clamps configured automation to the server execution mode", () => {
  const enabled = { ADS_EMERGENCY_STOP: "false" };
  assert.equal(getEffectiveAdsAutomationLevel("full", { ...enabled, ADS_EXECUTION_MODE: "semi" }), "semi");
  assert.equal(getEffectiveAdsAutomationLevel("supervised", { ...enabled, ADS_EXECUTION_MODE: "semi" }), "supervised");
  assert.equal(getEffectiveAdsAutomationLevel("invalid", { ...enabled, ADS_EXECUTION_MODE: "semi" }), "supervised");
  assert.equal(getEffectiveAdsAutomationLevel("semi", { ...enabled, ADS_EXECUTION_MODE: "full" }), "semi");
  assert.equal(getEffectiveAdsAutomationLevel("full", { ...enabled, ADS_EXECUTION_MODE: "full" }), "full");
});

test("emergency stop blocks mutations and forces supervised dry-run", () => {
  const env = { ...allowedEnv, ADS_EMERGENCY_STOP: "true" };
  const decision = evaluateAdsMutation({
    operation: "pause_campaign",
    facebookPageId: "page-1",
    adAccountId: "123",
    env,
  });

  assert.equal(decision.allowed, false);
  assert.match(decision.reason, /khóa khẩn cấp/);
  assert.equal(shouldForceAdsDryRun(env), true);
  assert.equal(getEffectiveAdsAutomationLevel("full", env), "supervised");
});

test("requires the execution mode needed by the mutation", () => {
  const decision = evaluateAdsMutation({
    operation: "budget_increase",
    facebookPageId: "page-1",
    adAccountId: "123",
    minimumMode: "semi",
    env: { ...allowedEnv, ADS_EXECUTION_MODE: "supervised_manual" },
  });

  assert.equal(decision.allowed, false);
  assert.match(decision.reason, /yêu cầu semi/);
});

test("requires both Page and Ad Account allowlists", () => {
  const blockedPage = evaluateAdsMutation({
    operation: "pause_campaign",
    facebookPageId: "page-3",
    adAccountId: "123",
    env: allowedEnv,
  });
  const blockedAccount = evaluateAdsMutation({
    operation: "pause_campaign",
    facebookPageId: "page-1",
    adAccountId: "789",
    env: allowedEnv,
  });

  assert.equal(blockedPage.allowed, false);
  assert.match(blockedPage.reason, /Page.*allowlist/);
  assert.equal(blockedAccount.allowed, false);
  assert.match(blockedAccount.reason, /Ad Account.*allowlist/);
});

test("accepts normalized and act-prefixed allowlisted Ad Account IDs", () => {
  for (const adAccountId of ["123", "act_123", "456", "act_456"]) {
    const decision = evaluateAdsMutation({
      operation: "pause_campaign",
      facebookPageId: "page-1",
      adAccountId,
      env: allowedEnv,
    });
    assert.equal(decision.allowed, true, adAccountId);
  }
});
