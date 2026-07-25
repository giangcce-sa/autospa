import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Messenger migration preserves history and enforces one active Page conversation", async () => {
  const schema = await source("prisma/schema.prisma");
  const migration = await source("prisma/migrations/20260724234500_messenger_conversation_concurrency/migration.sql");
  const model = schema.slice(schema.indexOf("model LeadConversation"), schema.indexOf("model PendingApproval"));

  assert.match(model, /version\s+Int\s+@default\(0\)/);
  assert.match(model, /@@index\(\[facebookPageId, senderId, isComplete\]\)/);
  assert.match(migration, /ROW_NUMBER\(\) OVER/);
  assert.match(migration, /SET "isComplete" = true/);
  assert.equal(migration.includes('DELETE FROM "LeadConversation"'), false);
  assert.match(migration, /CREATE UNIQUE INDEX "LeadConversation_active_page_sender_key"/);
  assert.match(migration, /WHERE "facebookPageId" IS NOT NULL\s+AND "isComplete" = false/);
});

test("Messenger creation handles races and updates only the exact conversation Lead", async () => {
  const agent = await source("src/lib/lead-agent.ts");

  assert.match(agent, /Messenger conversation yêu cầu Facebook Page nội bộ/);
  assert.match(agent, /prisma\.\$transaction/);
  assert.match(agent, /isUniqueConstraintError/);
  assert.match(agent, /findFirstOrThrow/);
  assert.match(agent, /previousConversation\.leadId/);
  assert.match(agent, /where: \{ id: conv\.id, version: conv\.version, isComplete: false \}/);
  assert.match(agent, /version: \{ increment: 1 \}/);
  assert.match(agent, /tx\.lead\.update\(\{ where: \{ id: conv\.leadId \}/);
  assert.equal(agent.includes("prisma.lead.updateMany"), false);
});

test("workflow lifecycle persists stages and every terminal outcome", async () => {
  const workflows = await source("src/lib/workflows.ts");
  const route = await source("src/app/api/workflows/route.ts");
  const orchestrator = await source("src/lib/orchestrator.ts");
  const monitor = await source("src/lib/realtime-monitor.ts");

  assert.match(workflows, /async function executeWorkflow/);
  assert.match(workflows, /await persistWorkflowSteps\(runId, steps\)/);
  assert.match(workflows, /steps\.some\(\(step\) => step\.status === "failed"\)/);
  assert.match(workflows, /status: "failed", completedAt: new Date\(\)/);
  assert.match(workflows, /status: "completed"/);
  assert.match(workflows, /steps,\s+"council",\s+"Tổng hợp kế hoạch hành động"/);
  assert.match(workflows, /agent: "workflow"/);
  assert.match(route, /result\.status === "completed" \? 200 : 502/);
  assert.match(orchestrator, /status: result\.status === "completed" \? "executed" : "skipped"/);
  assert.match(monitor, /if \(wf\.status === "completed"\) workflowsTriggered\+\+/);
});
