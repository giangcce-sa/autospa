import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
const ownerEmail = process.env.E2E_OWNER_EMAIL ?? "owner-e2e@example.test";
const ownerPassword = process.env.E2E_OWNER_PASSWORD ?? "owner-e2e-password";
const viewerEmail = process.env.E2E_VIEWER_EMAIL ?? "viewer-e2e@example.test";
const viewerPassword = process.env.E2E_VIEWER_PASSWORD ?? "viewer-e2e-password";

assert(databaseUrl, "DATABASE_URL is required");
const databaseName = new URL(databaseUrl).pathname.slice(1);
assert(/(?:^|_)e2e(?:_|$)/i.test(databaseName) || /(?:^|_)test(?:_|$)/i.test(databaseName), `Refusing to seed non-test database: ${databaseName}`);

const pool = new pg.Pool({ connectionString: databaseUrl });
const users = [
  { email: ownerEmail, password: ownerPassword, name: "E2E Owner", role: "owner" },
  { email: viewerEmail, password: viewerPassword, name: "E2E Viewer", role: "viewer" },
];

try {
  for (const user of users) {
    const hashedPwd = await bcrypt.hash(user.password, 10);
    await pool.query(
      `INSERT INTO "User" ("id", "email", "name", "hashedPwd", "role", "createdAt")
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT ("email") DO UPDATE
       SET "name" = EXCLUDED."name", "hashedPwd" = EXCLUDED."hashedPwd", "role" = EXCLUDED."role"`,
      [`e2e-${user.role}`, user.email.toLowerCase(), user.name, hashedPwd, user.role],
    );
  }
  await pool.query(
    `INSERT INTO "BrainSkill" (
       "id", "name", "description", "domain", "category", "tags", "inputSignals",
       "triggerType", "triggerConfig", "playbook", "tools", "successMetric",
       "permissionLevel", "riskLevel", "confidence", "classificationConfidence",
       "status", "learnedFrom", "councilNotes", "createdAt", "updatedAt"
     ) VALUES (
       'e2e-brain-skill', 'E2E Caption Guard', 'Kiểm tra metadata và lifecycle canonical Brain.',
       'content', 'caption', '["e2e","caption"]', '["draft_created"]', 'manual',
       '{"source":"e2e"}', 'Review caption trước khi publish.', '["reviewer"]', 'review_pass_rate',
       'supervised', 'medium', 0.82, 0.91, 'draft', 'e2e_seed', 'E2E council provenance', NOW(), NOW()
     )
     ON CONFLICT ("id") DO UPDATE SET
       "name" = EXCLUDED."name", "description" = EXCLUDED."description",
       "domain" = EXCLUDED."domain", "category" = EXCLUDED."category",
       "tags" = EXCLUDED."tags", "inputSignals" = EXCLUDED."inputSignals",
       "triggerType" = EXCLUDED."triggerType", "triggerConfig" = EXCLUDED."triggerConfig",
       "playbook" = EXCLUDED."playbook", "tools" = EXCLUDED."tools",
       "successMetric" = EXCLUDED."successMetric", "permissionLevel" = EXCLUDED."permissionLevel",
       "riskLevel" = EXCLUDED."riskLevel", "confidence" = EXCLUDED."confidence",
       "classificationConfidence" = EXCLUDED."classificationConfidence",
       "status" = EXCLUDED."status", "learnedFrom" = EXCLUDED."learnedFrom",
       "councilNotes" = EXCLUDED."councilNotes", "updatedAt" = NOW()`,
  );

  await pool.query("BEGIN");
  try {
    await pool.query(`DELETE FROM "AdsCreateOperation" WHERE "id" = 'e2e-ads-operation'`);
    await pool.query(`DELETE FROM "PostAsset" WHERE "id" = 'e2e-creative-asset'`);
    await pool.query(`DELETE FROM "ContentReview" WHERE "id" = 'e2e-creative-review'`);
    await pool.query(`DELETE FROM "ContentGeneration" WHERE "id" = 'e2e-creative-generation'`);
    await pool.query(`DELETE FROM "ImageGeneration" WHERE "id" = 'e2e-creative-image'`);
    await pool.query(`DELETE FROM "VideoProject" WHERE "id" = 'e2e-creative-video'`);
    await pool.query(`DELETE FROM "Post" WHERE "id" IN ('e2e-creative-draft', 'e2e-bulk-post')`);
    await pool.query(`DELETE FROM "BulkPlan" WHERE "id" = 'e2e-bulk-plan'`);
    await pool.query(`DELETE FROM "BrandKit" WHERE "id" = 'e2e-creative-brand'`);
    await pool.query(`DELETE FROM "Service" WHERE "id" = 'e2e-creative-service'`);
    await pool.query(`DELETE FROM "UserPageAccess" WHERE "userId" = 'e2e-viewer' AND "facebookPageId" = 'e2e-creative-page'`);
    await pool.query(`DELETE FROM "IntelligenceSignal" WHERE "id" LIKE 'e2e-creative-signal-%'`);
    await pool.query(`DELETE FROM "JobRun" WHERE "id" = 'e2e-creative-job'`);

    await pool.query(
      `INSERT INTO "FacebookPage" (
         "id", "fbPageId", "pageName", "accessToken", "isActive", "adAccountId",
         "adsReadinessStatus", "adsReadinessError", "createdAt"
       ) VALUES (
         'e2e-creative-page', 'e2e-creative-fb-page', 'E2E Creative Spa', 'e2e-page-token', TRUE, NULL,
         'unchecked', 'E2E fixture chưa cấu hình Ad Account ID', NOW()
       )
       ON CONFLICT ("id") DO UPDATE SET
         "fbPageId" = EXCLUDED."fbPageId", "pageName" = EXCLUDED."pageName",
         "accessToken" = EXCLUDED."accessToken", "isActive" = TRUE, "adAccountId" = NULL,
         "adsReadinessStatus" = 'unchecked', "adsReadinessError" = 'E2E fixture chưa cấu hình Ad Account ID'`,
    );
    await pool.query(
      `INSERT INTO "UserPageAccess" ("id", "userId", "facebookPageId", "permission", "createdAt")
       VALUES ('e2e-viewer-creative-access', 'e2e-viewer', 'e2e-creative-page', 'viewer', NOW())`,
    );
    await pool.query(
      `INSERT INTO "BrandKit" ("id", "facebookPageId", "primaryColor", "accentColor", "fontStyle", "spaName", "tagline", "updatedAt")
       VALUES ('e2e-creative-brand', 'e2e-creative-page', '#6C5CE7', '#F43F6E', 'elegant', 'E2E Creative Spa', 'Fixture kiểm thử', NOW())`,
    );
    await pool.query(
      `INSERT INTO "Service" ("id", "facebookPageId", "name", "description", "price", "active", "createdAt", "updatedAt")
       VALUES ('e2e-creative-service', 'e2e-creative-page', 'Peel da an toàn', 'Dịch vụ fixture cho Creative', 'Liên hệ', TRUE, NOW(), NOW())`,
    );
    await pool.query(
      `INSERT INTO "Post" (
         "id", "facebookPageId", "title", "summary", "outline", "hooks", "topicTags", "targetChannels",
         "caption", "hashtags", "platform", "postType", "tone", "status", "scheduledAt", "qualityNotes", "createdAt", "updatedAt"
       ) VALUES (
         'e2e-creative-draft', 'e2e-creative-page', 'Quy trình peel an toàn E2E',
         'Brief fixture để kiểm thử hành trình Creative từ ý tưởng tới xuất bản.',
         '["Soi da","Thực hiện peel","Chăm sóc sau peel"]', '["Peel mùa hè có an toàn không?"]',
         '["Kiến thức","Chăm sóc da"]', '["facebook"]',
         'Peel da an toàn bắt đầu từ soi da và lựa chọn nồng độ phù hợp.', '#peelda #spa',
         'facebook', 'educational', 'professional', 'draft', NOW() + INTERVAL '1 day',
         'AI-RESEARCH: Quy trình peel an toàn E2E', NOW() - INTERVAL '2 hour', NOW()
       )`,
    );
    await pool.query(
      `INSERT INTO "AdsCreateOperation" (
         "id", "idempotencyKey", "requestHash", "postId", "facebookPageId", "fbPageId", "adAccountId",
         "currency", "actorId", "input", "status", "currentStep", "campaignId", "adSetId", "attempt",
         "error", "createdAt", "updatedAt"
       ) VALUES (
         'e2e-ads-operation', 'e2e-ads-idempotency', 'e2e-request-hash', 'e2e-creative-draft',
         'e2e-creative-page', 'e2e-creative-fb-page', 'e2e-ad-account', 'VND', 'e2e-owner', '{}',
         'failed', 'adset', 'e2e-campaign', 'e2e-adset', 2, 'E2E provider unavailable fixture',
         NOW() - INTERVAL '30 minute', NOW() - INTERVAL '20 minute'
       )`,
    );
    await pool.query(
      `INSERT INTO "PostAsset" ("id", "postId", "kind", "name", "url", "mimeType", "sizeBytes", "position", "source", "createdAt")
       VALUES ('e2e-creative-asset', 'e2e-creative-draft', 'image', 'peel-e2e.jpg', 'mock://creative-image', 'image/jpeg', 1258291, 0, 'upload', NOW())`,
    );
    await pool.query(
      `INSERT INTO "ContentReview" ("id", "postId", "status", "score", "issues", "reviewer", "reviewedAt")
       VALUES ('e2e-creative-review', 'e2e-creative-draft', 'pass', 92, '[]', 'e2e', NOW())`,
    );
    await pool.query(
      `INSERT INTO "ContentGeneration" (
         "id", "postId", "facebookPageId", "promptVersion", "model", "mode", "narrator", "brief",
         "draftCaption", "editorCaption", "finalCaption", "humanScore", "scoreDetails", "createdAt", "updatedAt"
       ) VALUES (
         'e2e-creative-generation', 'e2e-creative-draft', 'e2e-creative-page', 'e2e-v1', 'e2e-model', 'research', 'brand',
         '{"topic":"peel"}', 'Peel da an toàn', 'Peel da an toàn', 'Peel da an toàn', 91, '[]', NOW() - INTERVAL '2 hour', NOW()
       )`,
    );
    await pool.query(
      `INSERT INTO "BulkPlan" ("id", "name", "month", "year", "status", "facebookPageId", "createdAt", "updatedAt")
       VALUES ('e2e-bulk-plan', 'Kế hoạch E2E', 8, 2026, 'draft', 'e2e-creative-page', NOW() - INTERVAL '1 day', NOW())`,
    );
    await pool.query(
      `INSERT INTO "Post" (
         "id", "facebookPageId", "bulkPlanId", "caption", "hashtags", "platform", "postType", "tone", "status", "scheduledAt", "createdAt", "updatedAt"
       ) VALUES (
         'e2e-bulk-post', 'e2e-creative-page', 'e2e-bulk-plan', 'Bài fixture trong kế hoạch hàng loạt E2E.', '#e2e',
         'facebook', 'service', 'friendly', 'draft', NOW() + INTERVAL '2 day', NOW() - INTERVAL '1 day', NOW()
       )`,
    );
    await pool.query(
      `INSERT INTO "ImageGeneration" (
         "id", "facebookPageId", "prompt", "finalPrompt", "imageUrl", "scoreDetails", "preset", "format", "qualityScore", "createdAt", "updatedAt"
       ) VALUES (
         'e2e-creative-image', 'e2e-creative-page', 'E2E creative image', 'E2E creative image', 'mock://creative-gallery', '[]',
         'educational', 'square', 88, NOW() - INTERVAL '1 hour', NOW()
       )`,
    );
    await pool.query(
      `INSERT INTO "VideoProject" (
         "id", "facebookPageId", "name", "brief", "status", "approvalStatus", "sourcePostId", "createdAt", "updatedAt"
       ) VALUES (
         'e2e-creative-video', 'e2e-creative-page', 'Video peel E2E', 'Video fixture cho Creative', 'draft', 'draft',
         'e2e-creative-draft', NOW() - INTERVAL '1 hour', NOW()
       )`,
    );
    await pool.query(
      `INSERT INTO "IntelligenceSignal" ("id", "source", "topic", "volume", "trend", "fetchedAt") VALUES
       ('e2e-creative-signal-old', 'google_trends', 'peel da an toàn E2E', 100, 'stable', NOW() - INTERVAL '7 day'),
       ('e2e-creative-signal-new', 'google_trends', 'peel da an toàn E2E', 180, 'rising', NOW() - INTERVAL '1 hour')`,
    );
    await pool.query(
      `INSERT INTO "JobRun" ("id", "name", "status", "trigger", "summary", "startedAt", "completedAt")
       VALUES ('e2e-creative-job', 'daily_report', 'success', 'e2e', 'Đồng bộ Creative fixture', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '59 minute')`,
    );
    await pool.query("COMMIT");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }

  console.log(`Seeded owner, viewer, Brain, and Creative fixtures in ${databaseName}`);
} finally {
  await pool.end();
}
