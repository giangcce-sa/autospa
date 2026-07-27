import assert from "node:assert/strict";
import test from "node:test";
import { pickTrigger } from "../src/lib/proactive-sales-policy.ts";

const NOW = new Date("2026-07-26T00:00:00.000Z");
const daysAgo = (days, from = NOW) => new Date(from.getTime() - days * 86400000);

function customer(overrides = {}) {
  return {
    id: "c1",
    name: "Chị Lan",
    phone: "0900000000",
    fbId: null,
    birthday: null,
    segment: "regular",
    lastContact: daysAgo(5),
    npsScore: null,
    ...overrides,
  };
}

test("Post-NPS upsell wins over cold reactivation for happy customers away 45+ days", () => {
  const both = pickTrigger(customer({ npsScore: 4, lastContact: daysAgo(70) }), NOW);
  assert.equal(both.type, "post_nps");
  assert.match(both.reason, /4⭐/);
  assert.match(both.reason, /70 ngày/);

  // NPS below 4 loses the upsell path and falls through to cold reactivation.
  assert.equal(pickTrigger(customer({ npsScore: 3, lastContact: daysAgo(70) }), NOW).type, "cold_reactivation");

  // Exactly 45 days does not qualify (needs > 45), and 45 < 60 means no cold trigger either.
  assert.equal(pickTrigger(customer({ npsScore: 5, lastContact: daysAgo(45) }), NOW), null);
});

test("Cold reactivation fires after 60 days, including never-contacted customers", () => {
  const cold = pickTrigger(customer({ lastContact: daysAgo(61) }), NOW);
  assert.deepEqual(cold, { type: "cold_reactivation", reason: "61 ngày chưa liên hệ" });

  assert.equal(pickTrigger(customer({ lastContact: daysAgo(60) }), NOW), null);

  // Unknown last contact counts as 999 days.
  const never = pickTrigger(customer({ lastContact: null }), NOW);
  assert.equal(never.type, "cold_reactivation");
  assert.match(never.reason, /999 ngày/);
});

test("Birthday triggers within the next 7 days for MM-DD and YYYY-MM-DD formats", () => {
  const short = pickTrigger(customer({ birthday: "07-30" }), NOW);
  assert.equal(short.type, "birthday");
  assert.match(short.reason, /Sinh nhật trong \d ngày/);

  const long = pickTrigger(customer({ birthday: "1990-07-30" }), NOW);
  assert.equal(long.type, "birthday");

  // Birthday already passed this year rolls to next year — no trigger in July.
  assert.equal(pickTrigger(customer({ birthday: "07-20" }), NOW), null);
});

test("Birthday wraps across New Year and beats the VIP trigger", () => {
  const yearEnd = new Date("2026-12-30T00:00:00.000Z");
  const wrapped = pickTrigger(customer({ birthday: "01-02", lastContact: daysAgo(5, yearEnd) }), yearEnd);
  assert.equal(wrapped.type, "birthday");

  const vipWithBirthday = pickTrigger(
    customer({ segment: "vip", birthday: "07-28", lastContact: daysAgo(40) }),
    NOW,
  );
  assert.equal(vipWithBirthday.type, "birthday");
});

test("Invalid birthday formats are tolerated without throwing", () => {
  assert.equal(pickTrigger(customer({ birthday: "khong-biet" }), NOW), null);
  assert.equal(pickTrigger(customer({ birthday: "abc" }), NOW), null);
});

test("VIP loyalty care fires after 30 quiet days for VIP segment only", () => {
  const vip = pickTrigger(customer({ segment: "vip", lastContact: daysAgo(31) }), NOW);
  assert.equal(vip.type, "vip_loyal");
  assert.match(vip.reason, /Khách VIP — 31 ngày/);

  assert.equal(pickTrigger(customer({ segment: "vip", lastContact: daysAgo(30) }), NOW), null);
  assert.equal(pickTrigger(customer({ segment: "regular", lastContact: daysAgo(31) }), NOW), null);
});

test("No trigger for recently contacted regular customers", () => {
  assert.equal(pickTrigger(customer(), NOW), null);
});
