import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Today page server-loads URL-scoped data without an internal HTTP request", async () => {
  const page = await source("src/app/page.tsx");
  const dashboard = await source("src/components/modules/dashboard/Dashboard.tsx");

  assert.match(page, /await resolveWorkspaceAccess\(route, state\)/);
  assert.match(page, /await getTodayData\(\{/);
  assert.match(page, /pageIds,/);
  assert.match(page, /<Dashboard data=\{data\}/);
  assert.equal(page.includes("fetch("), false);
  assert.equal(dashboard.includes('"use client"'), false);
  assert.equal(dashboard.includes("fetch("), false);
  assert.equal(dashboard.includes("useActivePage"), false);
  assert.equal(dashboard.includes("useSession"), false);
});

test("command center is a thin authorized adapter over the Today DAL", async () => {
  const route = await source("src/app/api/dashboard/command-center/route.ts");
  const service = await source("src/lib/today.ts");

  assert.match(route, /await requirePageAccess\(facebookPageId\)/);
  assert.match(route, /await getTodayData\(\{/);
  assert.equal(route.includes("prisma."), false);
  assert.match(service, /import "server-only"/);
  assert.match(service, /buildTodayQueueTotals\(\{/);
  assert.match(service, /scheduledTodayCount/);
  assert.match(service, /careDueCount/);
  assert.match(service, /openAlertCount/);
  assert.match(service, /criticalAlertCount/);
  assert.match(service, /failedJobCount/);
  assert.equal(service.includes("queue.length,"), false);
  assert.equal(service.includes("scheduledToday.length"), false);
  assert.equal(service.includes("alerts.length"), false);
});

test("Today uses Vietnam business bounds and truthful metric metadata", async () => {
  const service = await source("src/lib/today.ts");
  const view = await source("src/components/modules/dashboard/Dashboard.tsx");

  assert.match(service, /getBusinessDayRange\(now\)/);
  assert.match(service, /getBusinessMonthRange\(now\)/);
  assert.match(service, /timeZone: BUSINESS_TIME_ZONE/);
  assert.match(service, /source: "booking_revenue\.paidAt"/);
  assert.match(service, /Chưa đọc không đồng nghĩa chưa được phản hồi/);
  assert.match(view, /giao dịch đã ghi nhận/);
  assert.match(view, /Tin nhắn chưa đọc/);
  assert.equal(view.includes("Hệ thống đang hoạt động bình thường"), false);
});

test("morning brief GET is owner-only and never generates or writes", async () => {
  const route = await source("src/app/api/morning-brief/route.ts");
  const getHandler = route.slice(route.indexOf("export async function GET"), route.indexOf("export async function POST"));

  assert.match(getHandler, /requireUser\(\{ owner: true \}\)/);
  assert.match(getHandler, /getMorningBrief\(\)/);
  assert.equal(getHandler.includes("generateMorningBrief"), false);
  assert.equal(getHandler.includes("prisma."), false);
  assert.match(route, /businessDateKey\(\)/);
});

test("global dashboard, activity, alerts, and mutations require owner access", async () => {
  for (const path of [
    "src/app/api/dashboard/route.ts",
    "src/app/api/dashboard/activity/route.ts",
    "src/app/api/realtime-alerts/route.ts",
  ]) {
    const value = await source(path);
    assert.match(value, /requireUser\(\{ owner: true \}\)/, `${path} must require owner access`);
    assert.match(value, /accessErrorResponse\(/, `${path} must preserve access status codes`);
  }
});
