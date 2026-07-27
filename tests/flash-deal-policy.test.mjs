import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DEFAULT_CAPACITY,
  businessDayAtNine,
  calcDiscount,
  computeSlotGaps,
} from "../src/lib/flash-deal-policy.ts";

test("Discount deepens as slots empty and adds urgency below 12 hours, capped at 35", () => {
  assert.equal(calcDiscount(0.1, 24), 30);
  assert.equal(calcDiscount(0.19, 24), 30);
  assert.equal(calcDiscount(0.2, 24), 20);
  assert.equal(calcDiscount(0.39, 24), 20);
  assert.equal(calcDiscount(0.4, 24), 10);
  assert.equal(calcDiscount(0.59, 24), 10);

  assert.equal(calcDiscount(0.3, 11), 25);
  assert.equal(calcDiscount(0.5, 11), 15);
  assert.equal(calcDiscount(0.3, 12), 20); // 12h is not urgent yet

  assert.equal(calcDiscount(0.1, 11), 35); // 30 + 5 hits the cap exactly
});

test("Business day at nine is 09:00 Vietnam time regardless of machine timezone", () => {
  assert.equal(
    businessDayAtNine(new Date("2026-07-20T10:00:00.000Z")).toISOString(),
    "2026-07-20T02:00:00.000Z",
  );
});

// now = 03:00 Vietnam time on 2026-07-20 → day 0 slot (09:00 +07) is 6h away.
const NOW = new Date("2026-07-19T20:00:00.000Z");

test("Empty days inside 48h become gaps; the 48h cutoff drops day 2", () => {
  const gaps = computeSlotGaps([], NOW);

  assert.deepEqual(gaps.map((gap) => gap.date), ["2026-07-20", "2026-07-21"]);
  assert.deepEqual(gaps.map((gap) => gap.hoursUntil), [6, 30]);
  for (const gap of gaps) {
    assert.equal(gap.filledSlots, 0);
    assert.equal(gap.estimatedCapacity, DEFAULT_CAPACITY);
    assert.equal(gap.fillRate, 0);
    assert.match(gap.label, /\d{2}\/\d{2}/);
  }
});

test("Fill rate at or above 60% removes the day from the gap list", () => {
  const appointment = new Date("2026-07-20T03:00:00.000Z"); // business day 2026-07-20
  const appts = Array.from({ length: 5 }, () => ({ preferredAt: appointment }));

  const gaps = computeSlotGaps(appts, NOW);
  assert.deepEqual(gaps.map((gap) => gap.date), ["2026-07-21"]);

  const four = computeSlotGaps(appts.slice(0, 4), NOW);
  assert.deepEqual(four.map((gap) => gap.date), ["2026-07-20", "2026-07-21"]);
  assert.equal(four[0].filledSlots, 4);
  assert.equal(four[0].fillRate, 0.5);
});

test("Appointments outside the 48h window and null slots are ignored", () => {
  const gaps = computeSlotGaps(
    [
      { preferredAt: new Date("2026-07-19T10:00:00.000Z") }, // before now
      { preferredAt: new Date("2026-07-22T05:00:00.000Z") }, // after cutoff
      { preferredAt: null },
    ],
    NOW,
  );

  assert.deepEqual(gaps.map((gap) => gap.filledSlots), [0, 0]);
});

test("The hoursUntil > 2 gate drops a day whose 09:00 slot is too close", () => {
  // now = 00:00Z → 07:00 Vietnam; day 0's 09:00 slot is exactly 2 hours away (gate needs > 2),
  // and day 2's slot lands past the 48h cutoff.
  const gaps = computeSlotGaps([], new Date("2026-07-20T00:00:00.000Z"));
  assert.deepEqual(gaps.map((gap) => gap.date), ["2026-07-21"]);
});

test("Custom capacity changes the fill-rate math", () => {
  const appointment = new Date("2026-07-20T03:00:00.000Z");
  const appts = [{ preferredAt: appointment }, { preferredAt: appointment }, { preferredAt: appointment }];

  const gaps = computeSlotGaps(appts, NOW, 4);
  assert.deepEqual(gaps.map((gap) => gap.date), ["2026-07-21"]); // 3/4 = 0.75 ≥ 0.6

  const wide = computeSlotGaps(appts, NOW, 8);
  assert.equal(wide[0].date, "2026-07-20");
  assert.equal(wide[0].fillRate, 3 / 8);
});

test("Slot-gap detection only ever counts pending and confirmed appointments", async () => {
  const engine = await readFile(new URL("../src/lib/flash-deal-engine.ts", import.meta.url), "utf8");
  assert.match(engine, /status: \{ in: \["pending", "confirmed"\] \}/);
  assert.match(engine, /computeSlotGaps\(appts, now\)/);
});
