import assert from "node:assert/strict";
import test from "node:test";
import { STEP_DELAYS, buildMessage, isNurtureDue } from "../src/lib/lead-nurture-policy.ts";

test("Nurture steps wait 1, 3, then 7 days", () => {
  assert.deepEqual(STEP_DELAYS, [1, 3, 7]);
});

test("Each nurture step gets its own message and uses the lead's service", () => {
  const first = buildMessage(0, "Chị Lan", "massage đá nóng");
  assert.match(first, /^Xin chào Chị Lan!/);
  assert.match(first, /massage đá nóng/);

  const second = buildMessage(1, "Chị Lan", "massage đá nóng");
  assert.match(second, /^Chào Chị Lan!/);
  assert.match(second, /ưu đãi đặc biệt/);

  const last = buildMessage(2, "Chị Lan", "massage đá nóng");
  assert.match(last, /tin nhắn cuối/);

  // Steps beyond 2 reuse the final message.
  assert.equal(buildMessage(3, "Chị Lan", "massage đá nóng"), last);
});

test("Placeholder channel names and empty names become 'bạn'", () => {
  assert.match(buildMessage(0, "Khách Facebook", null), /^Xin chào bạn!/);
  assert.match(buildMessage(1, "Khách Zalo", null), /^Chào bạn!/);
  assert.match(buildMessage(0, "", null), /^Xin chào bạn!/);
  assert.match(buildMessage(0, "Khách Facebook", null), /dịch vụ spa/); // null service fallback
});

const NOW = new Date("2026-07-26T12:00:00.000Z");
const hoursAgo = (hours) => new Date(NOW.getTime() - hours * 60 * 60 * 1000);

test("Step 0 is due 1 day after creation", () => {
  assert.equal(isNurtureDue({ nurtureStep: 0, nurtureSentAt: null, createdAt: hoursAgo(25) }, NOW), true);
  assert.equal(isNurtureDue({ nurtureStep: 0, nurtureSentAt: null, createdAt: hoursAgo(24) }, NOW), true);
  assert.equal(isNurtureDue({ nurtureStep: 0, nurtureSentAt: null, createdAt: hoursAgo(23) }, NOW), false);
});

test("Steps 1 and 2 wait 3 and 7 days from the last nurture send", () => {
  assert.equal(isNurtureDue({ nurtureStep: 1, nurtureSentAt: hoursAgo(73), createdAt: hoursAgo(200) }, NOW), true);
  assert.equal(isNurtureDue({ nurtureStep: 1, nurtureSentAt: hoursAgo(71), createdAt: hoursAgo(200) }, NOW), false);

  assert.equal(isNurtureDue({ nurtureStep: 2, nurtureSentAt: hoursAgo(169), createdAt: hoursAgo(400) }, NOW), true);
  assert.equal(isNurtureDue({ nurtureStep: 2, nurtureSentAt: hoursAgo(167), createdAt: hoursAgo(400) }, NOW), false);
});

test("nurtureSentAt takes precedence over createdAt when both exist", () => {
  // Created long ago but nurtured one hour ago: not due.
  assert.equal(isNurtureDue({ nurtureStep: 0, nurtureSentAt: hoursAgo(1), createdAt: hoursAgo(240) }, NOW), false);
});

test("Unknown steps fall back to a 7-day delay", () => {
  assert.equal(isNurtureDue({ nurtureStep: 5, nurtureSentAt: hoursAgo(8 * 24), createdAt: hoursAgo(400) }, NOW), true);
  assert.equal(isNurtureDue({ nurtureStep: 5, nurtureSentAt: hoursAgo(6 * 24), createdAt: hoursAgo(400) }, NOW), false);
});
