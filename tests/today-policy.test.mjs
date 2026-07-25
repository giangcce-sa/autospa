import assert from "node:assert/strict";
import test from "node:test";
import {
  BUSINESS_TIME_ZONE,
  buildTodayQueueTotals,
  businessDateKey,
  businessHour,
  getBusinessDayRange,
  getBusinessMonthRange,
  nextAnnualBusinessOccurrence,
} from "../src/lib/today-policy.ts";

test("Today policy uses the Ho Chi Minh business timezone", () => {
  assert.equal(BUSINESS_TIME_ZONE, "Asia/Ho_Chi_Minh");

  const beforeMidnightUtc = new Date("2026-07-22T16:59:59.999Z");
  const afterMidnightUtc = new Date("2026-07-22T17:00:00.000Z");

  assert.equal(businessDateKey(beforeMidnightUtc), "2026-07-22");
  assert.equal(businessDateKey(afterMidnightUtc), "2026-07-23");
});

test("Today policy returns Vietnam business hours across UTC day boundaries", () => {
  assert.equal(businessHour(new Date("2026-07-22T16:00:00.000Z")), 23);
  assert.equal(businessHour(new Date("2026-07-22T17:00:00.000Z")), 0);
});

test("Today policy returns exact UTC bounds for a Vietnam business day", () => {
  const range = getBusinessDayRange(new Date("2026-07-23T08:00:00.000Z"));

  assert.equal(range.start.toISOString(), "2026-07-22T17:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-07-23T16:59:59.999Z");
});

test("Today policy returns exact UTC bounds for a Vietnam business month", () => {
  const range = getBusinessMonthRange(new Date("2026-07-31T18:00:00.000Z"));

  assert.equal(range.start.toISOString(), "2026-07-31T17:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-08-31T16:59:59.999Z");
});

test("Annual business occurrence uses Vietnam midnight and includes today", () => {
  const occurrence = nextAnnualBusinessOccurrence(
    "07-23",
    new Date("2026-07-22T17:00:00.000Z"),
  );

  assert.equal(occurrence.eventDate.toISOString(), "2026-07-22T17:00:00.000Z");
  assert.equal(occurrence.daysUntil, 0);
});

test("Annual business occurrence rolls past dates into the next year", () => {
  const occurrence = nextAnnualBusinessOccurrence(
    "01-01",
    new Date("2026-07-23T08:00:00.000Z"),
  );

  assert.equal(occurrence.eventDate.toISOString(), "2026-12-31T17:00:00.000Z");
  assert.equal(occurrence.daysUntil, 162);
});

test("Annual business occurrence advances to the next valid leap day", () => {
  const occurrence = nextAnnualBusinessOccurrence(
    "02-29",
    new Date("2026-07-23T08:00:00.000Z"),
  );

  assert.equal(occurrence.eventDate.toISOString(), "2028-02-28T17:00:00.000Z");
  assert.equal(occurrence.daysUntil, 586);
});

test("Annual business occurrence rejects invalid month-day values", () => {
  assert.throws(
    () => nextAnnualBusinessOccurrence("02-30", new Date("2026-07-23T08:00:00.000Z")),
    /Ngày không hợp lệ/,
  );
  assert.throws(
    () => nextAnnualBusinessOccurrence("2-14", new Date("2026-07-23T08:00:00.000Z")),
    /MM-DD/,
  );
});

test("Today queue totals use independent aggregates rather than preview length", () => {
  assert.deepEqual(buildTodayQueueTotals({
    pendingApprovals: 7,
    reviewBlocked: 6,
    openAlerts: 5,
    criticalAlerts: 2,
    hotLeads: 4,
    unreadMessages: 3,
    pendingAppointments: 2,
    scheduledToday: 8,
    careDue: 9,
  }), {
    total: 44,
    critical: 15,
  });
});
