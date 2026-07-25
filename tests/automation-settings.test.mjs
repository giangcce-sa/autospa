import assert from "node:assert/strict";
import test from "node:test";
import { ZodError } from "zod";
import {
  parseAutomationSettingsPatch,
  parseCanonicalAutomationRequest,
  toAutomationSettingsDto,
} from "../src/lib/settings/automation-policy.ts";

test("canonical automation settings accept typed values and normalize nullable strings", () => {
  assert.deepEqual(parseCanonicalAutomationRequest({
    webhookMode: "auto",
    autoReplyComments: true,
    autoReplyMessages: false,
    leadHandoffMode: "link",
    leadHandoffLink: "  https://spa.example/booking  ",
    automationLevel: "semi",
    zaloApprovalRecipient: "  user-1  ",
  }), {
    webhookMode: "auto",
    autoReplyComments: true,
    autoReplyMessages: false,
    leadHandoffMode: "link",
    leadHandoffLink: "https://spa.example/booking",
    automationLevel: "semi",
    zaloApprovalRecipient: "user-1",
  });

  assert.deepEqual(parseCanonicalAutomationRequest({ leadHandoffLink: "  " }), { leadHandoffLink: null });
});

test("canonical automation settings reject unknown, Ads, and incorrectly typed values", () => {
  for (const input of [
    {},
    { adsOptimizeMaxBudget: 2_000_000 },
    { webhookMode: "sometimes" },
    { autoReplyComments: "false" },
    { automationLevel: "unlimited" },
    { webhookVerifyToken: 123 },
  ]) {
    assert.throws(() => parseCanonicalAutomationRequest(input), ZodError);
  }
});

test("legacy automation parser ignores unrelated fields", () => {
  assert.deepEqual(parseAutomationSettingsPatch({
    webhookMode: "manual",
    adsOptimizeMaxBudget: 9_000_000,
    imageModel: "dall-e-3",
  }), { webhookMode: "manual" });
});

test("canonical secret-only requests reject preserved values and accept replacements", () => {
  assert.throws(() => parseCanonicalAutomationRequest({ webhookVerifyToken: "" }), ZodError);
  assert.throws(() => parseCanonicalAutomationRequest({ webhookVerifyToken: "••••••••abcd" }), ZodError);
  assert.deepEqual(parseCanonicalAutomationRequest({ webhookVerifyToken: "  fresh-token  " }), {
    webhookVerifyToken: "fresh-token",
  });
});

test("automation settings only accept HTTP or HTTPS handoff links", () => {
  for (const leadHandoffLink of [
    "not-a-url",
    "javascript:alert(1)",
    "ftp://spa.example/booking",
  ]) {
    assert.throws(() => parseCanonicalAutomationRequest({ leadHandoffLink }), ZodError);
  }

  assert.deepEqual(parseCanonicalAutomationRequest({ leadHandoffLink: "http://spa.example/booking" }), {
    leadHandoffLink: "http://spa.example/booking",
  });
});

test("automation DTO returns defaults and never exposes the verification token", () => {
  const defaults = toAutomationSettingsDto(null);
  assert.equal(defaults.webhookMode, "manual");
  assert.equal(defaults.automationLevel, "supervised");
  assert.equal(defaults.hasWebhookVerifyToken, false);
  assert.equal(Object.hasOwn(defaults, "webhookVerifyToken"), false);

  const configured = toAutomationSettingsDto({
    webhookVerifyToken: "raw-secret",
    webhookMode: "auto",
    leadHandoffMode: "api",
    automationLevel: "full",
  });
  assert.equal(configured.hasWebhookVerifyToken, true);
  assert.equal(Object.hasOwn(configured, "webhookVerifyToken"), false);
});
