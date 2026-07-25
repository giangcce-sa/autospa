import assert from "node:assert/strict";
import test from "node:test";
import { ZodError } from "zod";
import {
  parseCanonicalVideoSettingsRequest,
  parseVideoProviderTestRequest,
  parseVideoSettingsPatch,
  toVideoSettingsDto,
} from "../src/lib/settings/video-policy.ts";

test("canonical Video settings normalize fields and preserve blank or masked secrets", () => {
  assert.deepEqual(parseCanonicalVideoSettingsRequest({
    runwayApiKey: " fresh-runway-key ",
    runwayBaseUrl: "https://api.dev.runwayml.com",
    elevenLabsApiKey: "••••••••abcd",
    syncLabsModel: " sync-3 ",
    videoMockMode: false,
    videoBudgetUsd: 50,
  }), {
    runwayApiKey: "fresh-runway-key",
    runwayBaseUrl: "https://api.dev.runwayml.com",
    syncLabsModel: "sync-3",
    videoMockMode: false,
    videoBudgetUsd: 50,
  });
  assert.throws(() => parseCanonicalVideoSettingsRequest({ runwayApiKey: "" }), ZodError);
});

test("canonical Video settings reject unknown, empty and invalid payloads", () => {
  for (const input of [
    {},
    { runwayApiKey: "••••••••" },
    { adsOptimizeMaxBudget: 1 },
    { videoMockMode: "false" },
    { videoBudgetUsd: 0 },
    { videoBudgetUsd: Number.NaN },
    { runwayBaseUrl: "http://localhost" },
    { runwayVideoModel: "" },
  ]) assert.throws(() => parseCanonicalVideoSettingsRequest(input), ZodError);
});

test("legacy Video parser ignores unrelated domains", () => {
  assert.deepEqual(parseVideoSettingsPatch({
    runwayVideoModel: "gen4.5",
    claudeApiKey: "outside-domain",
    adsOptimizeMaxBudget: 1,
  }), { runwayVideoModel: "gen4.5" });
});

test("Video provider test contract is strict and bounded", () => {
  assert.deepEqual(parseVideoProviderTestRequest({
    provider: "runway",
    apiKey: " fresh-key ",
    baseUrl: "https://api.dev.runwayml.com",
  }), {
    provider: "runway",
    apiKey: "fresh-key",
    baseUrl: "https://api.dev.runwayml.com",
  });
  assert.throws(() => parseVideoProviderTestRequest({ provider: "ffmpeg" }), ZodError);
  assert.throws(() => parseVideoProviderTestRequest({ provider: "sync", extra: true }), ZodError);
});

test("Video DTO reports secret source without exposing secret values", () => {
  const dto = toVideoSettingsDto({
    runwayApiKey: "encrypted-database-value",
    videoMockMode: false,
    videoBudgetUsd: 40,
  }, {
    runwayApiKey: "deployment-runway",
    elevenLabsApiKey: "deployment-eleven",
    videoExecutionMode: "live",
    videoEmergencyStop: "false",
  });

  assert.equal(dto.hasRunwayApiKey, true);
  assert.equal(dto.runwayKeySource, "database");
  assert.equal(dto.hasElevenLabsApiKey, true);
  assert.equal(dto.elevenLabsKeySource, "deployment");
  assert.equal(dto.hasSyncLabsApiKey, false);
  assert.equal(dto.syncLabsKeySource, "unconfigured");
  assert.equal(dto.videoMockMode, false);
  assert.equal(dto.videoBudgetUsd, 40);
  for (const field of ["runwayApiKey", "elevenLabsApiKey", "syncLabsApiKey"]) {
    assert.equal(Object.hasOwn(dto, field), false);
  }
});
