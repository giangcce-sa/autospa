import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function handler(route, method, nextMethod) {
  const start = route.indexOf(`export async function ${method}`);
  const end = nextMethod ? route.indexOf(`export async function ${nextMethod}`, start) : route.length;
  assert.notEqual(start, -1, `${method} handler must exist`);
  assert.notEqual(end, -1, `${nextMethod} handler must exist`);
  return route.slice(start, end);
}

test("BulkPlan stores transitional Page ownership with a restrictive relation", async () => {
  const schema = await source("prisma/schema.prisma");
  const facebookPage = schema.slice(schema.indexOf("model FacebookPage"), schema.indexOf("model TikTokAccount"));
  const bulkPlan = schema.slice(schema.indexOf("model BulkPlan"), schema.indexOf("model ContentReview"));

  assert.match(facebookPage, /bulkPlans\s+BulkPlan\[\]/);
  assert.match(bulkPlan, /facebookPageId\s+String\?/);
  assert.match(bulkPlan, /facebookPage\s+FacebookPage\?\s+@relation\(fields: \[facebookPageId\], references: \[id\], onDelete: Restrict\)/);
  assert.match(bulkPlan, /@@index\(\[facebookPageId, createdAt\]\)/);
});

test("BulkPlan migration backfills only provable single-Page ownership and quarantines the rest", async () => {
  const migration = await source("prisma/migrations/20260724190000_bulk_plan_page_ownership/migration.sql");

  assert.match(migration, /ALTER TABLE "BulkPlan" ADD COLUMN "facebookPageId" TEXT/);
  assert.match(migration, /COUNT\(p\."id"\) AS "postCount"/);
  assert.match(migration, /COUNT\(p\."facebookPageId"\) AS "ownedPostCount"/);
  assert.match(migration, /COUNT\(DISTINCT p\."facebookPageId"\) AS "pageCount"/);
  assert.match(migration, /ownership\."postCount" > 0/);
  assert.match(migration, /ownership\."ownedPostCount" = ownership\."postCount"/);
  assert.match(migration, /ownership\."pageCount" = 1/);
  assert.match(migration, /SET "status" = 'ownership_unknown'\s+WHERE "facebookPageId" IS NULL/);
  assert.match(migration, /CREATE INDEX "BulkPlan_facebookPageId_createdAt_idx"/);
  assert.match(migration, /REFERENCES "FacebookPage"\("id"\) ON DELETE RESTRICT ON UPDATE CASCADE/);
  assert.equal(migration.includes("DELETE FROM \"BulkPlan\""), false);
});

test("Bulk GET requires an explicit authorized Page and reads only its plans", async () => {
  const route = await source("src/app/api/bulk/route.ts");
  const get = handler(route, "GET", "POST");

  assert.match(get, /requireExplicitPageAccess\(facebookPageId\)/);
  assert.match(get, /prisma\.bulkPlan\.findMany\(\{[\s\S]*?where: \{ facebookPageId: page!\.id \}/);
  assert.match(get, /accessErrorResponse\(error\)/);
  assert.equal(get.includes("prisma.bulkPlan.findMany({\n      include:"), false);
});

test("Bulk POST authorizes before generation and persists one Page on plan and posts", async () => {
  const route = await source("src/app/api/bulk/route.ts");
  const post = handler(route, "POST", "DELETE");
  const authorizeAt = post.indexOf("requireExplicitPageAccess(facebookPageId, { owner: true })");
  const generateAt = post.indexOf("generateContent(prompt, systemPrompt)");

  assert.notEqual(authorizeAt, -1);
  assert.ok(generateAt > authorizeAt, "authorization must happen before provider generation");
  assert.match(post, /prisma\.service\.findMany\(\{ where: \{ facebookPageId: pageId, active: true \}/);
  assert.match(post, /prisma\.bulkPlan\.create\(\{[\s\S]*?facebookPageId: pageId,[\s\S]*?posts: \{[\s\S]*?facebookPageId: pageId/);
  assert.match(post, /getStyleProfile\(pageId\)/);
  assert.match(post, /accessErrorResponse\(err\)/);
});

test("Bulk DELETE derives owner authorization from stored plan ownership", async () => {
  const route = await source("src/app/api/bulk/route.ts");
  const remove = handler(route, "DELETE");
  const loadAt = remove.indexOf("prisma.bulkPlan.findUnique");
  const authorizeAt = remove.indexOf("requirePageAccess(plan.facebookPageId, { owner: true })");
  const transactionAt = remove.indexOf("prisma.$transaction");

  assert.ok(loadAt >= 0 && authorizeAt > loadAt, "stored ownership must be loaded before authorization");
  assert.ok(transactionAt > authorizeAt, "authorization must happen before deletion");
  assert.match(remove, /if \(!plan\.facebookPageId\) throw new AccessError\("Kế hoạch chưa xác định được Facebook Page", 409\)/);
  assert.match(remove, /prisma\.post\.deleteMany\(\{ where: \{ bulkPlanId: id, facebookPageId: plan\.facebookPageId \} \}\)/);
  assert.match(remove, /prisma\.bulkPlan\.delete\(\{ where: \{ id \} \}\)/);
  assert.match(remove, /accessErrorResponse\(error\)/);
});
