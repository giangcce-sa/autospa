import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import pg from "pg";

const { Client } = pg;
const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const migrationsDirectory = new URL("../prisma/migrations/", import.meta.url);
const baseMigrationBoundary = "20260721222000_ads_create_operations";
const targetMigrations = [
  "20260724190000_bulk_plan_page_ownership",
  "20260724201500_comment_rule_voice_page_ownership",
  "20260724210000_holiday_defaults",
  "20260724223000_durable_publishing",
  "20260724234500_messenger_conversation_concurrency",
];

async function applyMigration(client, name) {
  const sql = await readFile(new URL(`${name}/migration.sql`, migrationsDirectory), "utf8");
  await client.query(sql);
}

async function assertRejected(query, code) {
  await assert.rejects(query, (error) => error?.code === code);
}

async function seedBaseFixtures(client) {
  await client.query(`
    INSERT INTO "FacebookPage" ("id", "fbPageId", "pageName", "accessToken") VALUES
      ('page_a', 'fb_page_a', 'Page A', 'token-a'),
      ('page_b', 'fb_page_b', 'Page B', 'token-b'),
      ('page_publish', 'fb_page_publish', 'Publish Page', 'token-publish');

    INSERT INTO "BulkPlan" ("id", "name", "month", "year", "status", "updatedAt") VALUES
      ('plan_empty', 'Empty', 7, 2026, 'draft', CURRENT_TIMESTAMP),
      ('plan_single', 'Single Page', 7, 2026, 'draft', CURRENT_TIMESTAMP),
      ('plan_null', 'Null Child', 7, 2026, 'draft', CURRENT_TIMESTAMP),
      ('plan_mixed', 'Mixed Pages', 7, 2026, 'draft', CURRENT_TIMESTAMP);

    INSERT INTO "Post" ("id", "caption", "bulkPlanId", "facebookPageId", "updatedAt") VALUES
      ('post_single_1', 'Single 1', 'plan_single', 'page_a', CURRENT_TIMESTAMP),
      ('post_single_2', 'Single 2', 'plan_single', 'page_a', CURRENT_TIMESTAMP),
      ('post_null_owned', 'Owned child', 'plan_null', 'page_a', CURRENT_TIMESTAMP),
      ('post_null_unknown', 'Unknown child', 'plan_null', NULL, CURRENT_TIMESTAMP),
      ('post_mixed_a', 'Mixed A', 'plan_mixed', 'page_a', CURRENT_TIMESTAMP),
      ('post_mixed_b', 'Mixed B', 'plan_mixed', 'page_b', CURRENT_TIMESTAMP),
      ('post_publish', 'Publish fixture', NULL, 'page_publish', CURRENT_TIMESTAMP);

    INSERT INTO "HolidayEvent" (
      "id", "name", "date", "description", "isVietnamese", "isActive"
    ) VALUES (
      'custom_valentine', 'Valentine', '02-14', 'Custom description', TRUE, FALSE
    );

    INSERT INTO "Lead" ("id", "name", "updatedAt") VALUES
      ('lead_old', 'Old', CURRENT_TIMESTAMP),
      ('lead_new_a', 'New A', CURRENT_TIMESTAMP),
      ('lead_new_z', 'New Z', CURRENT_TIMESTAMP),
      ('lead_page_b', 'Page B', CURRENT_TIMESTAMP),
      ('lead_null_a', 'Null A', CURRENT_TIMESTAMP),
      ('lead_null_b', 'Null B', CURRENT_TIMESTAMP),
      ('lead_complete', 'Complete', CURRENT_TIMESTAMP);

    INSERT INTO "LeadConversation" (
      "id", "leadId", "senderId", "facebookPageId", "isComplete", "createdAt", "updatedAt"
    ) VALUES
      ('conv_old', 'lead_old', 'sender-shared', 'page_a', FALSE, '2026-07-01T00:00:00Z', CURRENT_TIMESTAMP),
      ('conv_new_a', 'lead_new_a', 'sender-shared', 'page_a', FALSE, '2026-07-02T00:00:00Z', CURRENT_TIMESTAMP),
      ('conv_new_z', 'lead_new_z', 'sender-shared', 'page_a', FALSE, '2026-07-02T00:00:00Z', CURRENT_TIMESTAMP),
      ('conv_page_b', 'lead_page_b', 'sender-shared', 'page_b', FALSE, '2026-07-01T00:00:00Z', CURRENT_TIMESTAMP),
      ('conv_null_a', 'lead_null_a', 'sender-null', NULL, FALSE, '2026-07-01T00:00:00Z', CURRENT_TIMESTAMP),
      ('conv_null_b', 'lead_null_b', 'sender-null', NULL, FALSE, '2026-07-02T00:00:00Z', CURRENT_TIMESTAMP),
      ('conv_complete', 'lead_complete', 'sender-shared', 'page_a', TRUE, '2026-07-03T00:00:00Z', CURRENT_TIMESTAMP);
  `);
}

test("upgrade migrations preserve legacy data and enforce new PostgreSQL invariants", {
  skip: databaseUrl ? false : "TEST_DATABASE_URL or DATABASE_URL is required",
}, async () => {
  const parsedUrl = new URL(databaseUrl);
  const databaseName = decodeURIComponent(parsedUrl.pathname.slice(1));
  assert.match(
    databaseName,
    /(?:_test|_e2e)$/,
    `Refusing migration fixture test against non-test database: ${databaseName}`,
  );

  const schema = `migration_upgrade_${process.pid}_${Date.now()}`;
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);

    const migrationEntries = await readdir(migrationsDirectory, { withFileTypes: true });
    const baseMigrations = migrationEntries
      .filter((entry) => entry.isDirectory() && entry.name <= baseMigrationBoundary)
      .map((entry) => entry.name)
      .sort();

    assert.equal(baseMigrations.at(-1), baseMigrationBoundary);
    for (const migration of baseMigrations) await applyMigration(client, migration);
    await seedBaseFixtures(client);

    await applyMigration(client, targetMigrations[0]);
    const bulkPlans = await client.query(`
      SELECT "id", "facebookPageId", "status"
      FROM "BulkPlan"
      ORDER BY "id"
    `);
    assert.deepEqual(bulkPlans.rows, [
      { id: "plan_empty", facebookPageId: null, status: "ownership_unknown" },
      { id: "plan_mixed", facebookPageId: null, status: "ownership_unknown" },
      { id: "plan_null", facebookPageId: null, status: "ownership_unknown" },
      { id: "plan_single", facebookPageId: "page_a", status: "draft" },
    ]);

    await applyMigration(client, targetMigrations[1]);
    await applyMigration(client, targetMigrations[2]);
    const holidaysAfterFirstRun = await client.query(`
      SELECT "id", "description", "isVietnamese", "isActive"
      FROM "HolidayEvent"
      WHERE "name" = 'Valentine' AND "date" = '02-14'
    `);
    assert.deepEqual(holidaysAfterFirstRun.rows, [{
      id: "custom_valentine",
      description: "Custom description",
      isVietnamese: true,
      isActive: false,
    }]);
    assert.equal((await client.query(`SELECT COUNT(*)::integer AS count FROM "HolidayEvent"`)).rows[0].count, 10);
    await applyMigration(client, targetMigrations[2]);
    assert.equal((await client.query(`SELECT COUNT(*)::integer AS count FROM "HolidayEvent"`)).rows[0].count, 10);

    await applyMigration(client, targetMigrations[3]);
    await client.query(`
      INSERT INTO "PublishOperation" (
        "id", "idempotencyKey", "requestHash", "postId", "facebookPageId",
        "source", "payload", "updatedAt"
      ) VALUES (
        'operation_1', 'key-1', 'hash-1', 'post_publish', 'page_publish',
        'manual', '{}', CURRENT_TIMESTAMP
      )
    `);
    const operation = (await client.query(`
      SELECT "status", "attempt", "leaseOwner", "completedAt"
      FROM "PublishOperation"
      WHERE "id" = 'operation_1'
    `)).rows[0];
    assert.deepEqual(operation, {
      status: "pending",
      attempt: 0,
      leaseOwner: null,
      completedAt: null,
    });

    await assertRejected(client.query(`
      INSERT INTO "PublishOperation" (
        "id", "idempotencyKey", "requestHash", "postId", "source", "payload", "updatedAt"
      ) VALUES ('operation_duplicate_key', 'key-1', 'hash-2', 'post_publish', 'manual', '{}', CURRENT_TIMESTAMP)
    `), "23505");
    await assertRejected(client.query(`
      INSERT INTO "PublishOperation" (
        "id", "idempotencyKey", "requestHash", "postId", "source", "payload", "updatedAt"
      ) VALUES ('operation_duplicate_hash', 'key-2', 'hash-1', 'post_publish', 'manual', '{}', CURRENT_TIMESTAMP)
    `), "23505");
    await assertRejected(client.query(`
      INSERT INTO "PublishOperation" (
        "id", "idempotencyKey", "requestHash", "postId", "source", "payload", "updatedAt"
      ) VALUES ('operation_bad_post', 'key-3', 'hash-3', 'missing-post', 'manual', '{}', CURRENT_TIMESTAMP)
    `), "23503");

    await client.query(`
      INSERT INTO "PublishChannelAttempt" (
        "id", "operationId", "channel", "attempt", "updatedAt"
      ) VALUES ('attempt_1', 'operation_1', 'facebook', 1, CURRENT_TIMESTAMP)
    `);
    await assertRejected(client.query(`
      INSERT INTO "PublishChannelAttempt" (
        "id", "operationId", "channel", "attempt", "updatedAt"
      ) VALUES ('attempt_duplicate', 'operation_1', 'facebook', 1, CURRENT_TIMESTAMP)
    `), "23505");
    await assertRejected(client.query(`DELETE FROM "Post" WHERE "id" = 'post_publish'`), "23503");
    await assertRejected(client.query(`DELETE FROM "FacebookPage" WHERE "id" = 'page_publish'`), "23503");
    await client.query(`DELETE FROM "PublishOperation" WHERE "id" = 'operation_1'`);
    assert.equal((await client.query(`SELECT COUNT(*)::integer AS count FROM "PublishChannelAttempt"`)).rows[0].count, 0);

    await applyMigration(client, targetMigrations[4]);
    const conversations = await client.query(`
      SELECT "id", "isComplete", "version"
      FROM "LeadConversation"
      ORDER BY "id"
    `);
    assert.deepEqual(conversations.rows, [
      { id: "conv_complete", isComplete: true, version: 0 },
      { id: "conv_new_a", isComplete: true, version: 0 },
      { id: "conv_new_z", isComplete: false, version: 0 },
      { id: "conv_null_a", isComplete: false, version: 0 },
      { id: "conv_null_b", isComplete: false, version: 0 },
      { id: "conv_old", isComplete: true, version: 0 },
      { id: "conv_page_b", isComplete: false, version: 0 },
    ]);
    await assertRejected(client.query(`
      INSERT INTO "LeadConversation" (
        "id", "leadId", "senderId", "facebookPageId", "isComplete", "updatedAt"
      ) VALUES ('conv_duplicate_active', 'lead_old', 'sender-shared', 'page_a', FALSE, CURRENT_TIMESTAMP)
    `), "23505");
    await client.query(`
      INSERT INTO "LeadConversation" (
        "id", "leadId", "senderId", "facebookPageId", "isComplete", "updatedAt"
      ) VALUES ('conv_null_c', 'lead_old', 'sender-null', NULL, FALSE, CURRENT_TIMESTAMP)
    `);
    assert.equal((await client.query(`
      SELECT COUNT(*)::integer AS count
      FROM "LeadConversation"
      WHERE "facebookPageId" IS NULL AND "isComplete" = FALSE
    `)).rows[0].count, 3);
  } finally {
    await client.query("SET search_path TO public").catch(() => undefined);
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => undefined);
    await client.end();
  }
});
