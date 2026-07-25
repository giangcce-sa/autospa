import assert from "node:assert/strict";
import test from "node:test";
import { ZodError } from "zod";
import {
  parseCanonicalConnectionSettingsRequest,
  parseConnectionSettingsPatch,
  parseConnectionTestRequest,
  toConnectionSettingsDto,
} from "../src/lib/settings/connections-policy.ts";
import { SpaUrlError, sameSpaOrigin, validateSpaApiUrl } from "../src/lib/spa-url-validation.ts";

test("canonical Connections normalize URL and preserve blank or masked secrets", () => {
  assert.deepEqual(parseCanonicalConnectionSettingsRequest({
    spaApiUrl: "  https://spa.example.com/api  ",
    spaApiKey: "  fresh-key  ",
    spaWebhookSecret: "••••••••abcd",
  }), {
    spaApiUrl: "https://spa.example.com/api",
    spaApiKey: "fresh-key",
  });
  assert.throws(() => parseCanonicalConnectionSettingsRequest({ spaApiKey: "" }), ZodError);
});

test("canonical Connections reject unknown and empty requests", () => {
  for (const input of [{}, { adsOptimizeMaxBudget: 1 }, { spaApiKey: 42 }]) {
    assert.throws(() => parseCanonicalConnectionSettingsRequest(input), ZodError);
  }
  assert.throws(() => parseConnectionTestRequest({ spaApiUrl: "" }), ZodError);
});

test("legacy Connections parser ignores other domains and supports explicit URL removal", () => {
  assert.deepEqual(parseConnectionSettingsPatch({ spaApiUrl: "", imageModel: "dall-e-3" }), { spaApiUrl: null });
  assert.deepEqual(parseConnectionSettingsPatch({ spaApiKey: "••••••••abcd", webhookMode: "auto" }), {});
});

test("Connections DTO exposes configured flags without secret values", () => {
  const dto = toConnectionSettingsDto({ spaApiUrl: "https://spa.example.com", spaApiKey: "key", spaWebhookSecret: null });
  assert.deepEqual(dto, {
    spaApiUrl: "https://spa.example.com",
    hasSpaApiKey: true,
    hasSpaWebhookSecret: false,
  });
  assert.equal(Object.hasOwn(dto, "spaApiKey"), false);
  assert.equal(Object.hasOwn(dto, "spaWebhookSecret"), false);
});

test("Spa URL validation enforces HTTPS, credentials, private hosts and optional allowlist", () => {
  assert.equal(validateSpaApiUrl("https://spa.example.com/api", ["spa.example.com"]), "https://spa.example.com/api");
  assert.throws(() => validateSpaApiUrl("http://spa.example.com", ["spa.example.com"]), SpaUrlError);
  assert.throws(() => validateSpaApiUrl("https://user:pass@spa.example.com", ["spa.example.com"]), SpaUrlError);
  assert.throws(() => validateSpaApiUrl("https://127.0.0.1", ["127.0.0.1"]), SpaUrlError);
  assert.throws(() => validateSpaApiUrl("https://169.254.169.254", ["169.254.169.254"]), SpaUrlError);
  assert.throws(() => validateSpaApiUrl("https://other.example.com", ["spa.example.com"]), SpaUrlError);
  assert.equal(sameSpaOrigin("https://spa.example.com/api", "https://spa.example.com/v2"), true);
  assert.equal(sameSpaOrigin("https://spa.example.com", "https://other.example.com"), false);
});
