import assert from "node:assert/strict";
import test from "node:test";
import { ZodError } from "zod";
import {
  parseCanonicalZaloSettingsRequest,
  parseTelegramSettingsPatch,
  parseZaloSettingsPatch,
  toTelegramSettingsDto,
  toZaloSettingsDto,
} from "../src/lib/settings/channels-policy.ts";

test("canonical Zalo settings preserve blank or masked tokens and reject unknown fields", () => {
  assert.deepEqual(parseCanonicalZaloSettingsRequest({ zaloOaId: "  oa-123  ", zaloToken: " fresh-token " }), {
    zaloOaId: "oa-123",
    zaloToken: "fresh-token",
  });
  assert.deepEqual(parseCanonicalZaloSettingsRequest({ zaloOaId: "" }), { zaloOaId: null });
  assert.throws(() => parseCanonicalZaloSettingsRequest({ zaloToken: "" }), ZodError);
  assert.throws(() => parseCanonicalZaloSettingsRequest({ zaloToken: "••••••abcd" }), ZodError);
  assert.throws(() => parseCanonicalZaloSettingsRequest({ adsOptimizeMaxBudget: 1 }), ZodError);
});

test("legacy Zalo parser ignores unrelated settings fields", () => {
  assert.deepEqual(parseZaloSettingsPatch({ zaloOaId: " oa-1 ", imageModel: "dall-e-3" }), { zaloOaId: "oa-1" });
  assert.deepEqual(parseZaloSettingsPatch({ webhookMode: "auto" }), {});
});

test("channel DTOs expose configured flags without raw or masked secrets", () => {
  const zalo = toZaloSettingsDto({ zaloToken: "secret", zaloOaId: "oa-1" });
  assert.deepEqual(zalo, { zaloOaId: "oa-1", hasZaloToken: true });
  assert.equal(Object.hasOwn(zalo, "zaloToken"), false);

  const telegram = toTelegramSettingsDto({ telegramBotToken: "secret" }, null);
  assert.equal(telegram.hasBotToken, true);
  assert.equal(Object.hasOwn(telegram, "telegramBotToken"), false);
  assert.equal(Object.hasOwn(telegram, "botTokenMasked"), false);
});

test("Telegram settings require strict booleans and bounded schedules", () => {
  assert.deepEqual(parseTelegramSettingsPatch({
    telegramBotToken: " fresh-token ",
    telegramChatId: " -10001 ",
    telegramAlerts: false,
    weeklyReportEnabled: true,
    weeklyReportDay: 0,
    weeklyReportHour: 23,
  }), {
    telegramChatId: "-10001",
    telegramAlerts: false,
    weeklyReportEnabled: true,
    weeklyReportDay: 0,
    weeklyReportHour: 23,
    telegramBotToken: "fresh-token",
  });
  assert.throws(() => parseTelegramSettingsPatch({ telegramAlerts: "false" }), ZodError);
  assert.throws(() => parseTelegramSettingsPatch({ weeklyReportDay: 7 }), ZodError);
  assert.throws(() => parseTelegramSettingsPatch({ weeklyReportHour: 24 }), ZodError);
});
