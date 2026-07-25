import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("canonical Connections route enforces owner access and one shared write", async () => {
  const route = await source("src/app/api/settings/connections/route.ts");
  const service = await source("src/lib/settings/connections.ts");

  assert.equal(route.match(/requireUser\(\{ owner: true \}\)/g)?.length, 2);
  assert.equal(route.includes("persistSettingsPatch("), false);
  assert.equal(service.match(/persistSettingsPatch\(/g)?.length, 1);
  assert.match(service, /assertSafeSpaApiUrl/);
  assert.match(service, /getSecretReplacement\(request\.spaApiKey\)/);
});

test("legacy Settings delegates Spa validation and tests unsaved values", async () => {
  const route = await source("src/app/api/settings/route.ts");
  const form = await source("src/components/modules/settings/SettingsForm.tsx");

  assert.match(route, /prepareConnectionSettingsPatch\(connectionPatch, currentSettings\)/);
  assert.match(route, /testConnectionSettings\(\{/);
  assert.equal(route.includes("updateData.spaApiUrl = body.spaApiUrl"), false);
  assert.match(form, /payload\.spaApiUrl = form\.spaApiUrl/);
  assert.match(form, /payload\.apiKey = form\.spaApiKey/);
});

test("canonical Settings server-loads Connections without internal HTTP", async () => {
  const workspace = await source("src/components/modules/settings/SettingsWorkspace.tsx");
  const routeRegistry = await source("src/config/routes.ts");

  assert.match(workspace, /currentView\.id === "connections" \? await getConnectionSettings\(\) : null/);
  assert.match(workspace, /<ConnectionSettingsForm initialSettings=\{connectionSettings\}/);
  assert.equal(workspace.includes("fetch("), false);
  assert.match(routeRegistry, /\{ id: "connections", label: "Kết nối", description: "Phần mềm spa và tích hợp nền\." \}/);
});

test("Spa GET is persisted-only and operational actions are owner POSTs", async () => {
  const route = await source("src/app/api/spa/route.ts");
  const dailyReport = await source("src/lib/daily-report.ts");
  const leadAgent = await source("src/lib/lead-agent.ts");
  const operationsActions = await source("src/components/modules/ai-rooms/AIRoomActions.tsx");
  const getStart = route.indexOf("export async function GET");
  const postStart = route.indexOf("export async function POST");
  const get = route.slice(getStart, postStart);
  const post = route.slice(postStart);

  assert.match(get, /await requireUser\(\)/);
  assert.match(get, /spaSync\.findUnique/);
  assert.equal(get.includes("pullSpaRevenue"), false);
  assert.equal(get.includes("testSpaConnection"), false);
  assert.equal(get.includes("pushLeadToSpa"), false);
  assert.equal(get.includes("upsert"), false);
  assert.match(post, /await requireUser\(\{ owner: true \}\)/);
  assert.match(route, /z\.literal\("test-connection"\)/);
  assert.match(route, /z\.literal\("pull-revenue"\)/);
  assert.match(route, /z\.literal\("push-lead"\)/);
  assert.ok(post.indexOf("requireUser({ owner: true })") < post.indexOf("pullSpaRevenue()"));
  assert.ok(post.indexOf("requireUser({ owner: true })") < post.indexOf("pushLeadToSpa({"));
  assert.equal(dailyReport.includes("pullSpaRevenue"), false);
  assert.match(dailyReport, /spaSync\.findUnique/);
  assert.equal(leadAgent.includes("pushLeadToSpa"), false);
  assert.match(operationsActions, /run\("spa-pull", "\/api\/spa", \{ action: "pull-revenue" \}\)/);
});

test("Spa webhook remains secret-bound and records each payment once", async () => {
  const route = await source("src/app/api/spa/route.ts");

  assert.match(route, /if \(action === "webhook" \|\| typeof body\.type === "string"\)/);
  assert.match(route, /verifySpaWebhook\(req\)/);
  assert.match(route, /createHash\("sha256"\)/);
  assert.match(route, /timingSafeEqual\(digest\(provided\), digest\(configuredSecret\)\)/);
  assert.match(route, /isUniqueConstraintError\(error\)/);
  assert.match(route, /if \(created\) \{[\s\S]*?logActivity/);
});

test("Spa client revalidates saved URL and blocks redirects", async () => {
  const client = await source("src/lib/spa-client.ts");

  assert.match(client, /await assertSafeSpaApiUrl\(settings\.spaApiUrl\)/);
  assert.match(client, /redirect: "error"/);
});
