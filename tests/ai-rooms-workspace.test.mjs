import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  isOutcomeStatus,
  isWorkflowName,
  parseOrchestratorActions,
  parseOrchestratorPriorities,
  parseOrchestratorSignals,
  parseWorkflowSteps,
} from "../src/lib/ai-runtime-types.ts";
import { getBrandAssetsReadiness } from "../src/lib/brand-assets-readiness.ts";

const readyBrandPage = {
  id: "page-1",
  pageName: "AutoSpa",
  isActive: true,
  hasBrandKit: true,
  serviceCount: 1,
  staffCount: 1,
  consentedStaffCount: 1,
  storyCount: 1,
  approvedStyleSampleCount: 3,
  hasStyleProfile: true,
};


test("AI persisted JSON parsers fail closed on malformed shapes", () => {
  assert.equal(parseOrchestratorSignals("[]"), null);
  assert.equal(parseOrchestratorPriorities('{"not":"an-array"}'), null);
  assert.equal(parseOrchestratorActions('[{"agent":"ads","action":"run","status":"unknown"}]'), null);
  assert.equal(parseWorkflowSteps('[{"agent":"content"}]'), null);
  assert.equal(parseOrchestratorPriorities('[{"agent":"ads_creative","score":90,"reason":"drop","recommendedAction":"review"},{"agent":"invalid","score":10,"reason":"bad","recommendedAction":"ignore"}]'), null);

  const signals = {
    revenue: { last7: 1, prev7: 2, deltaPct: -0.5 },
    leads: { hotUnclosed: 3, coldNoNurture: 4, newToday: 5 },
    inbox: { unread: 6 },
    comments: { negativeUnreplied: 7 },
    approvals: { pendingOver24h: 8 },
    posts: { scheduledTomorrow: 9, engagement7dAvg: 10, engagement14dPriorAvg: 11 },
    competitor: { surgeCount: 12, topPostId: null },
    forecast: { next7Predicted: 13, vsAverage: 0.1 },
    pendingDecisionFails: 14,
  };
  assert.deepEqual(parseOrchestratorSignals(JSON.stringify(signals)), signals);
  assert.deepEqual(parseOrchestratorPriorities('[{"agent":"ads_creative","score":90,"reason":"drop","recommendedAction":"review"}]'), [
    { agent: "ads_creative", score: 90, reason: "drop", recommendedAction: "review" },
  ]);
  assert.deepEqual(parseOrchestratorActions('[{"agent":"ads_creative","action":"review","status":"queued"}]'), [
    { agent: "ads_creative", action: "review", status: "queued" },
  ]);
});

test("AI status and workflow guards share canonical allowlists", () => {
  assert.equal(isOutcomeStatus("neutral"), true);
  assert.equal(isOutcomeStatus("executed"), false);
  assert.equal(isWorkflowName("revenue_drop"), true);
  assert.equal(isWorkflowName("arbitrary_workflow"), false);
});

test("Brand readiness uses one shared five-check policy", () => {
  assert.deepEqual(getBrandAssetsReadiness(readyBrandPage), { complete: 5, total: 5, ready: true });
  assert.deepEqual(getBrandAssetsReadiness({ ...readyBrandPage, approvedStyleSampleCount: 2 }), { complete: 4, total: 5, ready: false });
});


async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("canonical AI Rooms renders a local server workspace", async () => {
  const page = await source("src/app/system/ai-rooms/page.tsx");
  const workspace = await source("src/components/modules/ai-rooms/AIRoomsWorkspace.tsx");
  const routes = await source("src/config/routes.ts");

  assert.match(page, /<AIRoomsWorkspace searchParams=\{searchParams\}/);
  assert.equal(page.includes("<WorkspacePage"), false);
  assert.match(workspace, /await resolveWorkspaceAccess\(route, state, effectiveScope\)/);
  assert.match(workspace, /access\.canMutate/);
  assert.equal(workspace.includes("fetch("), false);
  assert.equal(/id: "system-ai-rooms"[\s\S]*?targetPath: "\/council"/.test(routes), false);
});

test("AI Rooms reads truthful persisted domains with aggregate queries", async () => {
  const reader = await source("src/lib/ai-rooms.ts");
  const workspace = await source("src/components/modules/ai-rooms/AIRoomsWorkspace.tsx");

  assert.match(reader, /import "server-only"/);
  assert.match(reader, /prisma\.cEODecision\.count\(/);
  assert.match(reader, /prisma\.brainSkill\.count\(/);
  assert.match(reader, /prisma\.workflowRun\.count\(/);
  assert.match(reader, /prisma\.pendingApproval\.count\(/);
  assert.match(reader, /effectiveStatus/);
  assert.match(reader, /GET không cập nhật database/);
  assert.match(reader, /schema chưa có agenda, participant hoặc evidence session chuẩn hóa/);
  assert.match(workspace, /CEODecision/);
});

test("canonical Brain exposes taxonomy, validated URL filters, metadata, runtime facts, and owner controls", async () => {
  const reader = await source("src/lib/ai-rooms.ts");
  const workspace = await source("src/components/modules/ai-rooms/AIRoomsWorkspace.tsx");
  const actions = await source("src/components/modules/ai-rooms/AIRoomActions.tsx");
  const url = await source("src/lib/workspace-url.ts");

  assert.match(reader, /BRAIN_TAXONOMY/);
  assert.match(reader, /invalidFilter/);
  assert.match(reader, /id: "__invalid_brain_filter__"/);
  assert.match(reader, /prisma\.brainSkill\.groupBy/);
  assert.match(reader, /prisma\.brainSkill\.count\(\{ where \}\)/);
  for (const field of ["tags", "inputSignals", "triggerType", "triggerConfig", "playbook", "tools", "successMetric", "classificationConfidence", "councilNotes", "latestRun", "latestOutcome", "versionCount", "feedbackCount"]) {
    assert.match(reader, new RegExp(`${field}:`));
  }
  for (const key of ["domain", "category", "risk"]) assert.match(url, new RegExp(`${key}\\?: string`));
  assert.match(workspace, /Brain Map|data\.map\.map/);
  assert.match(workspace, /name="domain"/);
  assert.match(workspace, /name="category"/);
  assert.match(workspace, /name="risk"/);
  assert.match(workspace, /Playbook và provenance/);
  assert.match(workspace, /canMutate \? <BrainSkillActions/);
  assert.match(actions, /await mutate\("\/api\/brain", \{ id, status/);
  assert.match(actions, /action: "outcome", skillId: id/);
});

test("AI execution APIs authenticate reads and reserve mutations for owners", async () => {
  const council = await source("src/app/api/council/route.ts");
  const brain = await source("src/app/api/brain/route.ts");
  const orchestrator = await source("src/app/api/orchestrator/route.ts");
  const workflows = await source("src/app/api/workflows/route.ts");
  const decisions = await source("src/app/api/ceo-decisions/route.ts");
  const quota = await source("src/app/api/rate-limit/route.ts");

  assert.match(council, /await requireUser\(\{ owner: true \}\)/);
  assert.match(brain, /export async function GET[\s\S]*?await requireUser\(\)/);
  assert.match(brain, /export async function POST[\s\S]*?await requireUser\(\{ owner: true \}\)/);
  assert.match(brain, /export async function PATCH[\s\S]*?await requireUser\(\{ owner: true \}\)/);
  assert.match(orchestrator, /export async function GET[\s\S]*?await requireUser\(\)/);
  assert.match(orchestrator, /export async function POST[\s\S]*?await requireUser\(\{ owner: true \}\)/);
  assert.match(workflows, /export async function GET[\s\S]*?await requireUser\(\)/);
  assert.match(workflows, /export async function POST[\s\S]*?await requireUser\(\{ owner: true \}\)/);
  assert.match(decisions, /export async function POST[\s\S]*?await requireUser\(\{ owner: true \}\)/);
  assert.match(decisions, /Cần id, outcome và lý do override/);
  assert.match(quota, /await requireUser\(\{ owner: true \}\)/);
  const alerts = await source("src/app/api/realtime-alerts/route.ts");
  assert.match(alerts, /export async function GET[\s\S]*?await requireUser\(\{ owner: true \}\)/);
  assert.match(alerts, /export async function POST[\s\S]*?await requireUser\(\{ owner: true \}\)/);
  assert.match(alerts, /Alert id không hợp lệ/);
});

test("canonical Operations is owner-only, SSR-loaded, provider-free, and shares its API reader", async () => {
  const routes = await source("src/config/routes.ts");
  const access = await source("src/lib/workspace-access.ts");
  const shell = await source("src/components/workspace/WorkspaceShell.tsx");
  const reader = await source("src/lib/automation-operations.ts");
  const api = await source("src/app/api/automation/route.ts");
  const workspace = await source("src/components/modules/ai-rooms/AIRoomsWorkspace.tsx");
  const actions = await source("src/components/modules/ai-rooms/AIRoomActions.tsx");

  assert.match(routes, /id: "operations"[\s\S]*?ownerOnly: true/);
  assert.match(access, /selectedView\?\.ownerOnly/);
  assert.match(access, /visibleViewIds/);
  assert.match(shell, /visibleViewIds\.includes\(view\.id\)/);
  assert.match(reader, /import "server-only"/);
  assert.match(reader, /getBusinessDayRange\(now\)/);
  assert.match(reader, /adsReadinessBlockReason\(page, now\)/);
  assert.match(reader, /getAdsSettings\(\)/);
  for (const sideEffect of ["getCampaigns(", "getInsights(", "runAdsOptimization(", "testSpaConnection(", "pullSpaRevenue(", "prisma.pendingApproval.update", "prisma.spaSync.update"]) {
    assert.equal(reader.includes(sideEffect), false);
  }
  assert.match(api, /await requireUser\(\{ owner: true \}\)/);
  assert.match(api, /await getAutomationOperationsData\(\)/);
  assert.match(workspace, /await getAutomationOperationsData\(\)/);
  assert.match(workspace, /Ads readiness persisted theo Page/);
  assert.match(workspace, /Spa sync persisted/);
  assert.match(actions, /"\/api\/automation\/ads-run"/);
  assert.match(actions, /action: "test-connection"/);
  assert.match(actions, /action: "pull-revenue"/);
});

test("canonical Orchestrator renders strict persisted facts and owner-only runtime state", async () => {
  const reader = await source("src/lib/ai-rooms.ts");
  const workspace = await source("src/components/modules/ai-rooms/AIRoomsWorkspace.tsx");
  const actions = await source("src/components/modules/ai-rooms/AIRoomActions.tsx");
  const alerts = await source("src/app/api/realtime-alerts/route.ts");

  assert.match(reader, /getAIRoomOrchestratorData\(canReadOwnerData = false\)/);
  assert.match(reader, /canReadOwnerData \? getAIRoomOrchestratorOwnerData\(\) : null/);
  assert.match(reader, /steps: parseWorkflowSteps\(run\.steps\)/);
  assert.match(reader, /executionWarning/);
  assert.match(reader, /getAllQuotas\(\)/);
  assert.match(workspace, /OrchestratorRunPanel/);
  assert.match(workspace, /Full signal snapshot/);
  assert.match(workspace, /Priorities đã xếp hạng/);
  assert.match(workspace, /Action states persisted/);
  assert.match(workspace, /Realtime alerts owner-only/);
  assert.match(workspace, /Persisted workflow steps không hợp lệ/);
  assert.match(workspace, /getAIRoomOrchestratorData\(access\.canMutate\)/);
  assert.match(actions, /action: "run-now"/);
  assert.match(actions, /action: "acknowledge-all"/);
  assert.match(actions, /action: "acknowledge", id/);
  assert.match(alerts, /await requireUser\(\{ owner: true \}\)/);
});

test("orchestrator and approval GET handlers are read-only", async () => {
  const orchestrator = await source("src/app/api/orchestrator/route.ts");
  const approvals = await source("src/app/api/approvals/route.ts");
  const automation = await source("src/app/api/automation/route.ts");
  const reader = await source("src/lib/ai-rooms.ts");

  const orchestratorGet = orchestrator.slice(orchestrator.indexOf("export async function GET"), orchestrator.indexOf("export async function POST"));
  assert.equal(orchestratorGet.includes("runOrchestrator("), false);
  const orchestratorReader = reader.slice(reader.indexOf("export async function getAIRoomOrchestratorData"), reader.indexOf("export async function getAIRoomApprovalsData"));
  for (const sideEffect of ["runOrchestrator(", "triggerWorkflow(", "runRealtimeMonitor(", "realtimeAlert.update", "checkAndIncrement("]) {
    assert.equal(orchestratorReader.includes(sideEffect), false);
  }
  assert.equal(approvals.includes("pendingApproval.update"), false);
  assert.equal(automation.includes("pendingApproval.updateMany"), false);
});

test("System overview server-loads readiness and only links to canonical owners", async () => {
  const page = await source("src/app/system/page.tsx");
  const reader = await source("src/lib/system-overview.ts");
  const overview = await source("src/components/modules/hubs/SystemOverview.tsx");

  assert.match(page, /await getSystemOverview\(\)/);
  assert.equal(page.includes("<HubPage"), false);
  assert.match(reader, /await Promise\.all\(\[/);
  assert.match(reader, /getSettingsOverview\(\)/);
  assert.match(reader, /getBrandAssetsOverview\(user\)/);
  assert.match(reader, /getAIRoomCounts\(\)/);
  assert.match(overview, /href=\{item\.href\}/);
  assert.match(overview, /Mở Settings/);
  assert.match(overview, /\/system\/brand-assets\?view=overview/);
  assert.match(overview, /\/system\/ai-rooms\?view=overview/);
  assert.match(overview, /label: "Vận hành"/);
  assert.match(overview, /label: "Cấu hình"/);
  assert.match(overview, /không phải phần trăm tiến độ/);
  assert.equal(overview.includes("fetch("), false);
});

test("System workspaces use dashboard presentation without moving configuration or weakening permissions", async () => {
  const aiRooms = await source("src/components/modules/ai-rooms/AIRoomsWorkspace.tsx");
  const brandAssets = await source("src/components/modules/brand-assets/BrandAssetsOverview.tsx");
  const settings = await source("src/components/modules/settings/SettingsOverview.tsx");
  const settingsWorkspace = await source("src/components/modules/settings/SettingsWorkspace.tsx");

  assert.match(aiRooms, /dashboard>/);
  assert.match(aiRooms, /Mỗi count là record độc lập/);
  assert.match(aiRooms, /canMutate \? "Owner có thể thực hiện mutation/);
  assert.match(brandAssets, /getBrandAssetsReadiness\(page\)/);
  assert.match(brandAssets, /consent/);
  assert.match(settings, /Kết nối/);
  assert.match(settings, /AI & Media/);
  assert.match(settings, /Dữ liệu & Bảo mật/);
  assert.match(settings, /chưa persist kết quả probe/);
  assert.match(settingsWorkspace, /await resolveWorkspaceAccess\(route, state, effectiveScope\)/);
  assert.match(settingsWorkspace, /<WorkspacePermissionState/);
});
