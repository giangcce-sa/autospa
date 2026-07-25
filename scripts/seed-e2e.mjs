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
  console.log(`Seeded owner, viewer, and Brain fixture in ${databaseName}`);
} finally {
  await pool.end();
}
