import assert from "node:assert/strict";
import test from "node:test";
import { ZodError } from "zod";
import {
  parseCanonicalImageSettingsRequest,
  parseCanonicalProviderSettingsRequest,
  parseImageSettingsPatch,
  parseProviderSettingsPatch,
  toProviderSettingsDto,
} from "../src/lib/settings/providers-policy.ts";

test("canonical provider settings normalize fields and preserve blank or masked secrets", () => {
  assert.deepEqual(parseCanonicalProviderSettingsRequest({
    claudeBaseUrl: "  https://api.anthropic.com  ",
    claudeApiKey: "  fresh-key  ",
    openaiApiKey: "••••••••abcd",
  }), {
    claudeBaseUrl: "https://api.anthropic.com",
    claudeApiKey: "fresh-key",
  });
  assert.throws(() => parseCanonicalProviderSettingsRequest({ claudeApiKey: "" }), ZodError);
});

test("canonical provider and image settings reject unknown or empty requests", () => {
  for (const input of [{}, { adsOptimizeMaxBudget: 1 }, { openaiChatModel: "" }]) {
    assert.throws(() => parseCanonicalProviderSettingsRequest(input), ZodError);
  }
  assert.throws(() => parseCanonicalImageSettingsRequest({}), ZodError);
  assert.throws(() => parseCanonicalImageSettingsRequest({ imageModel: "" }), ZodError);
});

test("legacy provider and image parsers ignore fields from other domains", () => {
  assert.deepEqual(parseProviderSettingsPatch({ claudeBaseUrl: "https://api.anthropic.com", imageModel: "dall-e-3" }), {
    claudeBaseUrl: "https://api.anthropic.com",
  });
  assert.deepEqual(parseImageSettingsPatch({ imageModel: "dall-e-3", webhookMode: "auto" }), {
    imageModel: "dall-e-3",
  });
});

test("provider DTO exposes configured flags without secret values", () => {
  const dto = toProviderSettingsDto({ claudeApiKey: "secret", openaiApiKey: null });
  assert.equal(dto.hasClaudeApiKey, true);
  assert.equal(dto.hasOpenaiApiKey, false);
  assert.equal(Object.hasOwn(dto, "claudeApiKey"), false);
  assert.equal(Object.hasOwn(dto, "openaiApiKey"), false);
});
