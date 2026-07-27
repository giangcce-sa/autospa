import assert from "node:assert/strict";
import test from "node:test";
import {
  HOLIDAY_BOOST,
  SCENARIO_MULTIPLIER,
  WEEKDAY_MULTIPLIER,
  computeStatsFromRevenues,
  detectHolidayBoost,
} from "../src/lib/forecast-policy.ts";

test("Scenario and weekday multipliers keep their calibrated values", () => {
  assert.deepEqual(SCENARIO_MULTIPLIER, { baseline: 1.0, ads_2x: 1.35, promo_30: 1.20, tet_boost: 1.50 });
  assert.equal(WEEKDAY_MULTIPLIER.length, 7);
  assert.equal(WEEKDAY_MULTIPLIER[1], 0.85); // Monday quiet
  assert.equal(WEEKDAY_MULTIPLIER[6], 1.30); // Saturday peak
});

test("History stats return zeros for an empty revenue window", () => {
  assert.deepEqual(computeStatsFromRevenues([]), {
    dailyAvg: 0,
    std: 0,
    weeklyAvg: [0, 0, 0, 0, 0, 0, 0],
    daysWithData: 0,
  });
});

test("History stats bucket a single day and fall back to dailyAvg on empty weekdays", () => {
  const paidAt = new Date("2026-07-20T12:00:00.000Z");
  const stats = computeStatsFromRevenues([
    { amount: 100_000, paidAt },
    { amount: 200_000, paidAt },
  ]);

  assert.equal(stats.daysWithData, 1);
  assert.equal(stats.dailyAvg, 300_000);
  assert.equal(stats.std, 0);

  const weekday = paidAt.getDay();
  for (let index = 0; index < 7; index++) {
    // The observed weekday averages its own revenue; every other day falls back to dailyAvg.
    assert.equal(stats.weeklyAvg[index], index === weekday ? 150_000 : 300_000, `weekday ${index}`);
  }
});

test("History stats compute the population standard deviation across days", () => {
  const dayA = new Date("2026-07-20T12:00:00.000Z");
  const dayB = new Date("2026-07-21T12:00:00.000Z");
  const stats = computeStatsFromRevenues([
    { amount: 100_000, paidAt: dayA },
    { amount: 300_000, paidAt: dayB },
  ]);

  assert.equal(stats.daysWithData, 2);
  assert.equal(stats.dailyAvg, 200_000);
  assert.equal(stats.std, 100_000);
  assert.equal(stats.weeklyAvg[dayA.getDay()], 100_000);
  assert.equal(stats.weeklyAvg[dayB.getDay()], 300_000);
});

test("Holiday boost applies the named multiplier on the exact business day", () => {
  const tet = detectHolidayBoost(new Date("2026-02-17T05:00:00.000Z"), [
    { name: "Tết Nguyên Đán", date: "02-17" },
  ]);
  assert.deepEqual(tet, { boost: 1.5, name: "Tết Nguyên Đán" });

  const womensDay = detectHolidayBoost(new Date("2026-03-08T05:00:00.000Z"), [
    { name: "Quốc tế Phụ nữ 8/3", date: "03-08" },
  ]);
  assert.deepEqual(womensDay, { boost: 1.4, name: "Quốc tế Phụ nữ 8/3" });

  const unknown = detectHolidayBoost(new Date("2026-03-08T05:00:00.000Z"), [
    { name: "Sinh nhật spa", date: "03-08" },
  ]);
  assert.deepEqual(unknown, { boost: 1.1, name: "Sinh nhật spa" });
});

test("Holiday boost ramps at 60% strength within 3 days before a known holiday", () => {
  const ramp = detectHolidayBoost(new Date("2026-03-06T05:00:00.000Z"), [
    { name: "Quốc tế Phụ nữ 8/3", date: "03-08" },
  ]);
  assert.equal(ramp.boost, 1 + (HOLIDAY_BOOST["8/3"] - 1) * 0.6);
  assert.equal(ramp.name, "chuẩn bị Quốc tế Phụ nữ 8/3");

  const tetRamp = detectHolidayBoost(new Date("2026-02-15T05:00:00.000Z"), [
    { name: "Tết Nguyên Đán", date: "02-17" },
  ]);
  assert.equal(tetRamp.boost, 1 + (HOLIDAY_BOOST["Tết"] - 1) * 0.6);
  assert.equal(tetRamp.name, "chuẩn bị Tết Nguyên Đán");
});

test("Holiday boost stays neutral outside the window and for unknown ramp names", () => {
  // Unknown holiday names get no pre-holiday ramp.
  const unknownRamp = detectHolidayBoost(new Date("2026-03-06T05:00:00.000Z"), [
    { name: "Sinh nhật spa", date: "03-08" },
  ]);
  assert.deepEqual(unknownRamp, { boost: 1.0, name: null });

  // The day after a holiday is not boosted.
  const after = detectHolidayBoost(new Date("2026-03-09T05:00:00.000Z"), [
    { name: "Quốc tế Phụ nữ 8/3", date: "03-08" },
  ]);
  assert.deepEqual(after, { boost: 1.0, name: null });

  // Far away from any holiday.
  const far = detectHolidayBoost(new Date("2026-06-01T05:00:00.000Z"), [
    { name: "Quốc tế Phụ nữ 8/3", date: "03-08" },
  ]);
  assert.deepEqual(far, { boost: 1.0, name: null });
});
