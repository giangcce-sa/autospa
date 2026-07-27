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

test("Comment and voice models store restrictive Page ownership without guessing legacy records", async () => {
  const schema = await source("prisma/schema.prisma");
  const migration = await source("prisma/migrations/20260724201500_comment_rule_voice_page_ownership/migration.sql");
  const rules = schema.slice(schema.indexOf("model CommentRule"), schema.indexOf("model MessageRule"));
  const voice = schema.slice(schema.indexOf("model HumanVoiceProfile"), schema.indexOf("model VisualProfile"));

  assert.match(rules, /facebookPageId\s+String\?/);
  assert.match(rules, /onDelete: Restrict/);
  assert.match(rules, /@@index\(\[facebookPageId, createdAt\]\)/);
  assert.match(voice, /facebookPage\s+FacebookPage\?\s+@relation\([\s\S]*?onDelete: Restrict\)/);
  assert.match(migration, /ALTER TABLE "CommentRule" ADD COLUMN "facebookPageId" TEXT/);
  assert.equal(migration.includes("UPDATE \"CommentRule\""), false);
  assert.match(migration, /UPDATE "HumanVoiceProfile" profile[\s\S]*?NOT EXISTS[\s\S]*?FROM "FacebookPage" page/);
});

test("Comments GET requires an explicit authorized Page and scopes comments, rules, and posts", async () => {
  const route = await source("src/app/api/comments/route.ts");
  const get = handler(route, "GET", "POST");

  assert.match(get, /requireExplicitPageAccess\(facebookPageId\)/);
  assert.match(get, /facebookPageId: pageId/);
  assert.match(get, /facebookPageId: null, post: \{ facebookPageId: pageId \}/);
  assert.match(get, /commentRule\.findMany\(\{ where: \{ facebookPageId: pageId \}/);
  assert.match(get, /post\.findMany\(\{[\s\S]*?where: \{ facebookPageId: pageId \}/);
  assert.match(get, /routeErrorResponse\(error/);
});

test("Comments mutations are owner-only and authorize stored ownership before provider calls", async () => {
  const route = await source("src/app/api/comments/route.ts");
  const post = handler(route, "POST", "DELETE");
  const remove = handler(route, "DELETE");

  assert.match(post, /await requireUser\(\{ owner: true \}\)/);
  assert.match(post, /requireStoredComment\(body\.commentId, body\.facebookPageId\)/);
  assert.match(post, /requireStoredRule\(body\.ruleId, body\.facebookPageId\)/);
  assert.ok(post.indexOf("requireStoredComment(body.commentId, body.facebookPageId)") < post.indexOf("generateContent("));
  assert.ok(post.indexOf("requireStoredComment(body.commentId, body.facebookPageId)", post.indexOf('body.action === "send-fb-reply"')) < post.indexOf("replyToFbComment("));
  assert.match(post, /post\.findFirst\(\{ where: \{ id: body\.postId, facebookPageId: pageId \}/);
  assert.equal(post.includes('orderBy: { createdAt: "desc" } });\n      const targetPostId'), false);
  assert.match(post, /fetchFbComments\(body\.postLimit, pageId\)/);
  assert.equal(post.includes("pagesToSync"), false);
  assert.match(remove, /requireStoredComment\(id, facebookPageId\)/);
});

test("Facebook webhook only applies rules owned by the receiving Page", async () => {
  const webhook = await source("src/app/api/webhook/facebook/route.ts");
  const facebook = await source("src/lib/facebook.ts");

  assert.match(webhook, /commentRule\.findMany\(\{ where: \{ facebookPageId, isActive: true \} \}\)/);
  assert.match(facebook, /fetchFbComments\(postLimit: number, facebookPageId: string\)/);
  assert.match(facebook, /replyToFbComment\(commentId: string, message: string, facebookPageId: string\)/);
});

test("Forecast GET is owner-only, validated, account-scoped, and provider-free", async () => {
  const route = await source("src/app/api/forecast/route.ts");
  const service = await source("src/lib/forecast.ts");

  assert.match(route, /z\.enum\(\["7", "30", "90"\]\)/);
  assert.match(route, /z\.enum\(\["baseline", "ads_2x", "promo_30", "tet_boost"\]\)/);
  assert.match(route, /await requireUser\(\{ owner: true \}\)/);
  assert.match(route, /save: false, useCouncil: false/);
  assert.match(route, /scope: "account", source: "BookingRevenue", windowDays: 90/);
  assert.equal(route.includes("export async function POST"), false);
  assert.match(service, /if \(opts\.useCouncil !== false\)/);
});

test("Attribution is a validated owner-only account report", async () => {
  const route = await source("src/app/api/reports/attribution/route.ts");
  const view = await source("src/components/modules/reports/RevenueAttribution.tsx");

  assert.match(route, /await requireUser\(\{ owner: true \}\)/);
  assert.match(route, /z\.enum\(\["7", "30", "90"\]\)/);
  assert.match(route, /scope: "account", source: "BookingRevenue", windowDays: days/);
  assert.match(route, /routeErrorResponse\(error/);
  assert.match(view, /Toàn tài khoản · BookingRevenue/);
});

test("Voice Profile derives owner authorization from the stored record and preserves the three-edit gate", async () => {
  const route = await source("src/app/api/content/voice-profile/route.ts");
  const research = await source("src/lib/content-research.ts");
  const generator = await source("src/components/modules/content/ContentGenerator.tsx");
  const patch = handler(route, "PATCH");

  assert.match(route, /requireExplicitPageAccess\(facebookPageId\)/);
  assert.match(patch, /humanVoiceProfile\.findUnique\(\{ where: \{ id \} \}\)/);
  assert.ok(patch.indexOf("humanVoiceProfile.findUnique") < patch.indexOf("requirePageAccess(profile.facebookPageId, { owner: true })"));
  assert.match(patch, /if \(autoApply && profile\.approvedEdits < 3\)/);
  assert.match(patch, /data: \{ autoApply \}/);
  assert.match(research, /getHumanVoiceProfile\(facebookPageId\)/);
  assert.match(generator, /disabled=\{!result\.voiceProfile\.autoApply && result\.voiceProfile\.approvedEdits < 3\}/);
});

test("Holiday GET is authenticated, persisted-only, and mutations are owner-only", async () => {
  const route = await source("src/app/api/holidays/route.ts");
  const migration = await source("prisma/migrations/20260724210000_holiday_defaults/migration.sql");
  const calendar = await source("src/components/modules/holidays/HolidayCalendar.tsx");
  const page = await source("src/app/holidays/page.tsx");
  const get = handler(route, "GET", "POST");
  const post = handler(route, "POST");

  assert.match(get, /await requireUser\(\)/);
  assert.match(get, /holidayEvent\.findMany/);
  assert.match(get, /nextAnnualBusinessOccurrence\(holiday\.date\)/);
  assert.equal(get.includes("createMany"), false);
  assert.equal(get.includes("generateContent"), false);
  assert.match(post, /await requireUser\(\{ owner: true \}\)/);
  assert.ok(post.indexOf("requireUser({ owner: true })") < post.indexOf("generateContent(prompt, systemPrompt)"));
  assert.match(route, /configuredEstimate/);
  assert.match(route, /Ngày cấu hình cố định; cần cập nhật theo từng năm/);
  assert.match(migration, /WHERE NOT EXISTS/);
  assert.equal(migration.includes("Tết Nguyên Đán"), false);
  assert.equal(migration.includes("Black Friday"), false);
  assert.match(page, /await requireUser\(\)/);
  assert.match(page, /canMutate=\{user\.role === "owner"\}/);
  assert.match(calendar, /if \(!canMutate\) return/);
  assert.match(calendar, /disabled=\{!canMutate\}/);
  assert.match(calendar, /\{canMutate && \(/);
});

test("Analytics generation is an explicit validated owner-only POST", async () => {
  const route = await source("src/app/api/analytics-agent/route.ts");
  const analyst = await source("src/components/modules/reports/AIAnalyst.tsx");
  const post = handler(route, "POST");

  assert.equal(route.includes("export async function GET"), false);
  assert.match(post, /await requireUser\(\{ owner: true \}\)/);
  assert.match(route, /z\.enum\(\["7d", "30d"\]\)/);
  assert.ok(post.indexOf("requireUser({ owner: true })") < post.indexOf("generateAnalyticsReport(timeframe)"));
  assert.match(analyst, /method: "POST"/);
  assert.match(analyst, /body: JSON\.stringify\(\{ timeframe \}\)/);
  assert.equal(analyst.includes("useEffect"), false);
  assert.match(analyst, /Phạm vi: toàn tài khoản/);
});
