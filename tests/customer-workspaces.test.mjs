import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("canonical CRM, Sales, and Care pages render the production Customer dispatcher", async () => {
  for (const [path, routeId] of [
    ["src/app/customers/crm/page.tsx", "customers-crm"],
    ["src/app/customers/sales/page.tsx", "customers-sales"],
    ["src/app/customers/care/page.tsx", "customers-care"],
  ]) {
    const page = await source(path);
    assert.match(page, new RegExp(`<CustomerWorkspace routeId="${routeId}"`));
    assert.equal(page.includes("<WorkspacePage"), false);
  }
});

test("Customer dispatcher resolves per-view scope and server-loads initial data", async () => {
  const workspace = await source("src/components/modules/customers/CustomerWorkspaces.tsx");
  const reader = await source("src/lib/customer-workspaces.ts");

  assert.match(workspace, /const effectiveScope = currentView\.scope \?\? route\.scope/);
  assert.match(workspace, /await resolveWorkspaceAccess\(route, state, effectiveScope\)/);
  assert.match(workspace, /await getCustomerWorkspaceData\(segment\)/);
  assert.match(workspace, /await getCustomerDetail\(access\.state\.id\)/);
  assert.match(workspace, /await getScopedLeads\(pageIds, access\.state\.status\)/);
  assert.match(workspace, /await getCareWorkspaceData\(status\)/);
  assert.match(reader, /import "server-only"/);
  assert.equal(workspace.includes("fetch("), false);
});

test("CRM and Care stay account-scoped while Sales includes only Page-owned leads", async () => {
  const route = await source("src/config/routes.ts");
  const reader = await source("src/lib/customer-workspaces.ts");
  const workspace = await source("src/components/modules/customers/CustomerWorkspaces.tsx");

  assert.match(route, /id: "customers-crm"[\s\S]*?scope: "account"/);
  assert.match(route, /id: "customers-sales"[\s\S]*?scope: "current_or_all"/);
  assert.match(route, /id: "customers-care"[\s\S]*?scope: "account"/);
  assert.match(reader, /conversations: \{ some: \{ facebookPageId: \{ in: pageIds \} \} \}/);
  assert.match(reader, /facebookPageId: conversations\[0\]\.facebookPageId!/);
  assert.match(workspace, /Lead thủ công, Zalo hoặc record chưa có Page ownership không xuất hiện/);
  assert.match(workspace, /CareMessage là draft và trạng thái ghi nhận ở cấp tài khoản/);
});

test("Customer APIs authenticate reads and reserve all mutations for owners", async () => {
  for (const path of [
    "src/app/api/crm/route.ts",
    "src/app/api/care/route.ts",
  ]) {
    const route = await source(path);
    assert.match(route, /export async function GET[\s\S]*?await requireUser\(\)/);
    assert.match(route, /export async function POST[\s\S]*?await requireUser\(\{ owner: true \}\)/);
    assert.match(route, /accessErrorResponse\(/);
  }

  const crm = await source("src/app/api/crm/route.ts");
  const sale = await source("src/app/api/sale/route.ts");
  const proactive = await source("src/app/api/proactive-sales/route.ts");
  assert.match(crm, /export async function DELETE[\s\S]*?await requireUser\(\{ owner: true \}\)/);
  assert.match(sale, /export async function POST[\s\S]*?await requireUser\(\{ owner: true \}\)/);
  assert.match(proactive, /export async function GET[\s\S]*?await requireUser\(\{ owner: true \}\)/);
  assert.match(proactive, /export async function POST[\s\S]*?await requireUser\(\{ owner: true \}\)/);
});

test("Sales mutations verify stored conversation ownership and use stored lead inputs", async () => {
  const sale = await source("src/app/api/sale/route.ts");
  const manager = await source("src/components/modules/sale/SaleManager.tsx");

  assert.match(sale, /await requireScopedLead\(body\.id, body\.facebookPageId\)/);
  assert.match(sale, /where: \{ id, conversations: \{ some: \{ facebookPageId \} \} \}/);
  assert.match(sale, /throw new AccessError\("Lead không thuộc Facebook Page đang chọn", 403\)/);
  assert.match(sale, /`Khách hàng "\$\{lead\.name\}"/);
  assert.match(manager, /facebookPageId: lead\.facebookPageId/);
  assert.match(manager, /canMutate && !canonical/);
});

test("CLV refresh is an owner-only POST and canonical overview is server-loaded", async () => {
  const route = await source("src/app/api/crm/insights/route.ts");
  const dashboard = await source("src/components/modules/crm/CLVDashboard.tsx");
  const workspace = await source("src/components/modules/customers/CustomerWorkspaces.tsx");

  const getHandler = route.slice(route.indexOf("export async function GET"), route.indexOf("export async function POST"));
  assert.equal(getHandler.includes("updateCachedCLV"), false);
  assert.match(route, /export async function POST[\s\S]*?requireUser\(\{ owner: true \}\)[\s\S]*?updateCachedCLV\(\)/);
  assert.match(dashboard, /fetch\("\/api\/crm\/insights", \{ method: "POST" \}\)/);
  assert.match(dashboard, /initialSummary\?: Summary; canMutate\?: boolean/);
  assert.match(workspace, /const summary = await getCustomerCLVSummary\(\)/);
  assert.match(workspace, /<CLVDashboard initialSummary=\{summary\} canMutate=\{access\.canMutate\}/);
});

test("Care UI distinguishes persisted status from external delivery", async () => {
  const manager = await source("src/components/modules/care/CareManager.tsx");
  const workspace = await source("src/components/modules/customers/CustomerWorkspaces.tsx");

  assert.match(manager, /Ghi nhận đã gửi/);
  assert.match(manager, /canMutate && m\.status === "pending"/);
  assert.match(workspace, /không chứng minh có external delivery ID hoặc kênh đã nhận thành công/);
});

test("canonical Customer mutations refresh server data without unscoped legacy reads", async () => {
  const crm = await source("src/components/modules/crm/CRMManager.tsx");
  const sale = await source("src/components/modules/sale/SaleManager.tsx");
  const care = await source("src/components/modules/care/CareManager.tsx");
  const crmView = await source("src/components/modules/customers/CustomerCRMView.tsx");
  const salesView = await source("src/components/modules/customers/CustomerSalesView.tsx");
  const workspace = await source("src/components/modules/customers/CustomerWorkspaces.tsx");

  assert.match(crm, /if \(onMutate\) onMutate\(\);[\s\S]*?else load\(filterSegment \|\| undefined\)/);
  assert.match(sale, /if \(onMutate\) onMutate\(\);[\s\S]*?else load\(\)/);
  assert.match(care, /if \(canonical\) router\.refresh\(\);[\s\S]*?else load\(\)/);
  assert.match(crmView, /onMutate=\{navigation\.refresh\}/);
  assert.match(salesView, /onMutate=\{navigation\.refresh\}/);
  assert.match(workspace, /<CareManager[\s\S]*?canonical/);
});

test("Customer client state follows refreshed server props and birthdays use the business timezone", async () => {
  const crm = await source("src/components/modules/crm/CRMManager.tsx");
  const sale = await source("src/components/modules/sale/SaleManager.tsx");
  const care = await source("src/components/modules/care/CareManager.tsx");
  const careRoute = await source("src/app/api/care/route.ts");
  const policy = await source("src/lib/today-policy.ts");

  assert.match(crm, /setSelected\(initialCustomer \?\? null\)/);
  assert.match(sale, /setLeads\(initialLeads\)/);
  assert.match(care, /setMessages\(initialMessages\)/);
  assert.match(care, /businessMonthDay\(\)/);
  assert.match(careRoute, /const monthDay = businessMonthDay\(\)/);
  assert.match(policy, /export function businessMonthDay/);
});
