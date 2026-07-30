import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("canonical Growth pages render local production workspaces", async () => {
  for (const [path, component] of [
    ["src/app/growth/ads/page.tsx", "GrowthAdsWorkspace"],
    ["src/app/growth/promotions/page.tsx", "GrowthPromotionsWorkspace"],
    ["src/app/growth/intelligence/page.tsx", "GrowthIntelligenceWorkspace"],
  ]) {
    const page = await source(path);
    assert.match(page, new RegExp(`<${component} searchParams=\\{searchParams\\}`));
    assert.equal(page.includes("<WorkspacePage"), false);
  }
});

test("Growth landing resolves authorized Page scope and aggregates persisted data only", async () => {
  const page = await source("src/app/growth/page.tsx");
  const reader = await source("src/lib/growth-overview.ts");
  const overview = await source("src/components/modules/growth/GrowthOverview.tsx");

  assert.match(page, /await resolveWorkspaceAccess\(route, state, "current_or_all"\)/);
  assert.match(page, /access\.state\.scope === "all"/);
  assert.match(page, /<GrowthOverview data=\{data\} access=\{access\}/);
  assert.match(reader, /import "server-only"/);
  assert.match(reader, /const pageFilter = \{ facebookPageId: \{ in: pageIds \} \}/);
  assert.match(reader, /await Promise\.all\(\[/);
  assert.match(reader, /getIntelligencePerformance\(pageIds, scope\)/);
  assert.match(reader, /prisma\.adsCreateOperation\.findMany/);
  assert.match(reader, /postType: "promotion"/);
  assert.equal(reader.includes("getInsights("), false);
  assert.equal(reader.includes("getCampaigns("), false);
  assert.equal(reader.includes("generate"), false);
  assert.match(reader, /availability: promotions\.length \? "available" as const : "unavailable" as const/);
  assert.match(reader, /không được diễn giải thành thị trường không có rủi ro/);
  assert.match(overview, /không gọi Meta hoặc AI provider/);
  assert.match(overview, /unavailable=\{performance\.totals\.reach == null\}/);
  assert.match(overview, /badge=\{\{ label: "Không phải AI"/);
});

test("Growth dashboard compact tabs are accessible and preserve desktop panels", async () => {
  const tabs = await source("src/components/dashboard/DashboardTabs.tsx");
  const overview = await source("src/components/modules/growth/GrowthOverview.tsx");

  assert.match(tabs, /role="tablist"/);
  assert.match(tabs, /role="tab"/);
  assert.match(tabs, /role="tabpanel"/);
  assert.match(tabs, /event\.key === "ArrowRight"/);
  assert.match(tabs, /event\.key === "ArrowLeft"/);
  assert.match(tabs, /event\.key === "Home"/);
  assert.match(tabs, /event\.key === "End"/);
  assert.match(tabs, /active \? "block" : "hidden lg:block"/);
  assert.match(overview, /label: "Tổng quan"/);
  assert.match(overview, /label: "Hiệu quả"/);
  assert.match(overview, /label: "Cơ hội"/);
});

test("Growth Intelligence uses mixed Page and account scopes", async () => {
  const routes = await source("src/config/routes.ts");
  assert.match(routes, /id: "growth-intelligence"[\s\S]*?id: "reports"[\s\S]*?id: "performance"/);
  assert.match(routes, /id: "competitors"[\s\S]*?scope: "account"/);
  assert.match(routes, /id: "listening"[\s\S]*?scope: "account"/);
});

test("Growth Intelligence server-loads Page-safe data without internal HTTP", async () => {
  const workspace = await source("src/components/modules/growth/GrowthIntelligenceWorkspace.tsx");
  const reader = await source("src/lib/growth-intelligence.ts");

  assert.match(workspace, /const effectiveScope = currentView\.scope \?\? route\.scope/);
  assert.match(workspace, /await resolveWorkspaceAccess\(route, state, effectiveScope\)/);
  assert.match(workspace, /await getIntelligencePerformance\(pageIds/);
  assert.match(workspace, /await getCompetitorIntelligence\(\)/);
  assert.match(workspace, /await getListeningIntelligence\(\)/);
  assert.equal(workspace.includes("fetch("), false);
  assert.match(reader, /import "server-only"/);
  assert.match(reader, /facebookPageId: \{ in: pageIds \}/);
  assert.match(reader, /prisma\.post\.count\(/);
  assert.match(reader, /prisma\.postAnalytics\.aggregate\(/);
  assert.match(reader, /measured === 0 \? "unavailable"/);
  assert.match(reader, /completeness/);
});

test("Intelligence avoids fake CRM attribution and missing analytics zeros", async () => {
  const workspace = await source("src/components/modules/growth/GrowthIntelligenceWorkspace.tsx");
  const reader = await source("src/lib/growth-intelligence.ts");
  const reports = await source("src/app/api/reports/route.ts");

  assert.match(workspace, /CRM, lead và doanh thu chưa có ownership tương thích/);
  assert.match(reader, /Chưa có PostAnalytics[\s\S]*không được suy diễn thành 0/);
  assert.match(reports, /crm: null/);
  assert.match(reports, /bySource: \[\]/);
  assert.equal(reports.includes("prisma.customer"), false);
  assert.equal(reports.includes("prisma.lead"), false);
  assert.equal(reports.includes("prisma.careMessage"), false);
});

test("Intelligence APIs authenticate reads and reserve writes for owners", async () => {
  for (const path of [
    "src/app/api/reports/route.ts",
    "src/app/api/analytics/route.ts",
    "src/app/api/competitors/route.ts",
    "src/app/api/listening/route.ts",
  ]) {
    const route = await source(path);
    assert.match(route, /accessErrorResponse\(/);
  }

  const reports = await source("src/app/api/reports/route.ts");
  const analytics = await source("src/app/api/analytics/route.ts");
  const competitors = await source("src/app/api/competitors/route.ts");
  const listening = await source("src/app/api/listening/route.ts");

  assert.match(reports, /const user = await requireUser\(\{ owner \}\)/);
  assert.match(reports, /export async function POST[\s\S]*?resolveReportScope\(req, true\)/);
  assert.match(analytics, /await requireExplicitPageAccess\(post\.facebookPageId, \{ owner: true \}\)/);
  assert.match(analytics, /Post chưa có Facebook Page ownership/);
  assert.match(competitors, /export async function GET[\s\S]*?await requireUser\(\)/);
  assert.match(competitors, /export async function POST[\s\S]*?await requireUser\(\{ owner: true \}\)/);
  assert.match(listening, /export async function GET[\s\S]*?await requireUser\(\)/);
  assert.match(listening, /export async function POST[\s\S]*?await requireUser\(\{ owner: true \}\)/);
});

test("competitor responses never serialize access tokens", async () => {
  const route = await source("src/app/api/competitors/route.ts");
  const reader = await source("src/lib/growth-intelligence.ts");
  const legacy = await source("src/components/modules/competitors/CompetitorView.tsx");

  assert.match(route, /hasDedicatedToken: Boolean\(competitor\.accessToken\)/);
  assert.equal(route.includes("accessToken: competitor.accessToken"), false);
  assert.match(reader, /hasDedicatedToken: Boolean\(competitor\.accessToken\)/);
  assert.equal(reader.includes("accessToken: competitor.accessToken"), false);
  assert.match(legacy, /Đã cấu hình — để trống để giữ nguyên/);
  assert.match(legacy, /form\.accessToken\.trim\(\) \? \{ accessToken: form\.accessToken \} : \{\}/);
});

test("analytics uses Vietnam business time and rejects unscoped lead metrics", async () => {
  const analytics = await source("src/app/api/analytics/route.ts");
  const policy = await source("src/lib/today-policy.ts");

  assert.match(analytics, /businessDateKey\(post\.publishedAt\)/);
  assert.match(analytics, /businessHour\(post\.publishedAt\)/);
  assert.match(analytics, /Lead chưa có Page ownership nhất quán/);
  assert.match(policy, /export function businessHour/);
});

test("Promotions persists a Page-owned draft and hands off to Publishing", async () => {
  const route = await source("src/app/api/promotions/route.ts");
  const manager = await source("src/components/modules/promotions/PromotionManager.tsx");
  const flashDeal = await source("src/app/api/flash-deal/route.ts");

  assert.match(route, /await requirePageAccess\(facebookPageId, \{ owner: true \}\)/);
  assert.match(route, /facebookPageId,[\s\S]*?serviceId: service\?\.id \?\? null/);
  assert.match(route, /status: "draft"/);
  assert.match(manager, /id=\$\{encodeURIComponent\(postId\)\}/);
  assert.match(manager, /Review và phân phối/);
  assert.match(flashDeal, /await requireUser\(\{ owner: true \}\)/);
  assert.match(flashDeal, /Flash Deal chỉ tạo đề xuất/);
});

test("Flash Deal detection uses business dates and cannot publish directly", async () => {
  const engine = await source("src/lib/flash-deal-engine.ts");
  // Gap detection math now lives in the pure policy module the engine delegates to.
  const policy = await source("src/lib/flash-deal-policy.ts");
  const cron = await source("src/app/api/cron/flash-deal/route.ts");
  const executor = await source("src/lib/approval-executor.ts");

  assert.match(engine, /computeSlotGaps\(appts, now\)/);
  assert.match(policy, /businessDateKey\(appointment\)/);
  assert.match(policy, /T09:00:00\+07:00/);
  assert.equal(engine.includes("export async function postFlashDeal"), false);
  assert.equal(cron.includes("postFlashDeal"), false);
  assert.match(cron, /persist Post draft và phân phối qua canonical Publishing/);
  assert.match(executor, /Flash Deal approval cũ không còn thực thi trực tiếp/);
});

test("Ads canonical workspace exposes policy context and correct CTR units", async () => {
  const workspace = await source("src/components/modules/growth/GrowthAdsWorkspace.tsx");
  const campaigns = await source("src/components/modules/facebook-ads/CampaignList.tsx");
  const insights = await source("src/components/modules/facebook-ads/AdsInsights.tsx");

  assert.match(workspace, /context\.policy\.executionMode/);
  assert.match(workspace, /context\.policy\.writeBlocker/);
  assert.match(workspace, /Resource mới luôn được tạo ở trạng thái PAUSED/);
  assert.match(workspace, /canMutate=\{canMutate && !context\.policy\.writeBlocker\}/);
  assert.equal(campaigns.includes("Number(n) * 100"), false);
  assert.equal(insights.includes("Number(n) * 100"), false);
  assert.equal(workspace.includes("view === \"overview\" ? getAdsCampaignData"), false);
});
