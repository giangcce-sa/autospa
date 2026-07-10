import assert from "node:assert/strict";
import test from "node:test";
import { isTelegramActorAllowed, splitTelegramText, vietnamClock } from "../src/lib/telegram-control.ts";

test("allows only the configured private Telegram user", () => {
  assert.equal(isTelegramActorAllowed({
    configuredChatId: "123",
    chatId: "123",
    senderId: "123",
  }), true);
  assert.equal(isTelegramActorAllowed({
    configuredChatId: "123",
    chatId: "123",
    senderId: "999",
  }), false);
});

test("requires an explicit admin for Telegram groups", () => {
  assert.equal(isTelegramActorAllowed({
    configuredChatId: "-1001",
    chatId: "-1001",
    senderId: "123",
  }), false);
  assert.equal(isTelegramActorAllowed({
    configuredChatId: "-1001",
    configuredAdminUserId: "123",
    chatId: "-1001",
    senderId: "123",
  }), true);
});

test("calculates weekly schedule in Vietnam timezone", () => {
  assert.deepEqual(vietnamClock(new Date("2026-07-13T01:00:00.000Z")), { day: 1, hour: 8 });
});

test("splits long Telegram reports without losing content", () => {
  const text = `${"A".repeat(20)}\n${"B".repeat(20)}\n${"C".repeat(20)}`;
  const chunks = splitTelegramText(text, 30);
  assert.equal(chunks.length, 3);
  assert.equal(chunks.join("\n"), text);
  assert.equal(chunks.every((chunk) => chunk.length <= 30), true);
});
