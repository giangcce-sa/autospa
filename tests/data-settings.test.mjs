import assert from "node:assert/strict";
import test from "node:test";
import { ZodError } from "zod";
import {
  parseCanonicalDataSettingsRequest,
  parseDataSettingsPatch,
  toDataSettingsDto,
} from "../src/lib/settings/data-policy.ts";

test("canonical data settings accept bounded integer retention values", () => {
  assert.deepEqual(parseCanonicalDataSettingsRequest({
    draftRetentionDays: 0,
    publishedRetentionDays: 3650,
  }), {
    draftRetentionDays: 0,
    publishedRetentionDays: 3650,
  });
});

test("canonical data settings reject empty, unknown, fractional, and out-of-range values", () => {
  for (const input of [
    {},
    { backupProvider: "drive" },
    { draftRetentionDays: "30" },
    { draftRetentionDays: -1 },
    { publishedRetentionDays: 3651 },
    { publishedRetentionDays: 1.5 },
  ]) {
    assert.throws(() => parseCanonicalDataSettingsRequest(input), ZodError);
  }
});

test("legacy data parser ignores unrelated fields but validates supplied retention values", () => {
  assert.deepEqual(parseDataSettingsPatch({ draftRetentionDays: 45, webhookMode: "auto" }), {
    draftRetentionDays: 45,
  });
  assert.throws(() => parseDataSettingsPatch({ draftRetentionDays: Number.NaN }), ZodError);
});

test("data settings DTO uses stable defaults", () => {
  assert.deepEqual(toDataSettingsDto(null), {
    draftRetentionDays: 30,
    publishedRetentionDays: 90,
  });
});
