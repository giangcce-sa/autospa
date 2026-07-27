// One-shot backfill: encrypt plaintext DB secrets at rest (enc:v2).
// Lazy encryption already converts rows on their next save — this script just
// finishes the job in one pass. Idempotent: already-encrypted values are skipped.
//
// Usage:  node --experimental-strip-types scripts/encrypt-secrets.mjs
// Needs:  DATABASE_URL, plus SECRETS_ENCRYPTION_KEY or AUTH_SECRET.
// Take a backup first: npm run db:backup

import pg from "pg";
import { encryptSecret, isEncryptedSecret } from "../src/lib/secrets-crypto.ts";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
if (!process.env.SECRETS_ENCRYPTION_KEY && !process.env.AUTH_SECRET) {
  console.error("SECRETS_ENCRYPTION_KEY or AUTH_SECRET is required");
  process.exit(1);
}

const SETTINGS_SECRET_COLUMNS = [
  "claudeApiKey",
  "openaiApiKey",
  "zaloToken",
  "webhookVerifyToken",
  "spaApiKey",
  "spaWebhookSecret",
  "telegramBotToken",
  "telegramWebhookSecret",
  "runwayApiKey",
  "elevenLabsApiKey",
  "syncLabsApiKey",
];

const TOKEN_TABLES = [
  { table: "FacebookPage", columns: ["accessToken"] },
  { table: "TikTokAccount", columns: ["accessToken", "refreshToken"] },
  { table: "GoogleAccount", columns: ["accessToken", "refreshToken"] },
  { table: "Competitor", columns: ["accessToken"] },
];

function needsEncryption(value) {
  return typeof value === "string" && value !== "" && !isEncryptedSecret(value);
}

const pool = new pg.Pool({ connectionString });
let changed = 0;

try {
  const settingsCols = SETTINGS_SECRET_COLUMNS.map((c) => `"${c}"`).join(", ");
  const settingsRows = await pool.query(`SELECT "id", ${settingsCols} FROM "Settings"`);
  for (const row of settingsRows.rows) {
    const updates = [];
    const values = [];
    for (const column of SETTINGS_SECRET_COLUMNS) {
      if (needsEncryption(row[column])) {
        values.push(encryptSecret(row[column]));
        updates.push(`"${column}" = $${values.length}`);
      }
    }
    if (updates.length > 0) {
      values.push(row.id);
      await pool.query(`UPDATE "Settings" SET ${updates.join(", ")} WHERE "id" = $${values.length}`, values);
      changed += updates.length;
      console.log(`Settings ${row.id}: encrypted ${updates.length} column(s)`);
    }
  }

  for (const { table, columns } of TOKEN_TABLES) {
    const cols = columns.map((c) => `"${c}"`).join(", ");
    const rows = await pool.query(`SELECT "id", ${cols} FROM "${table}"`);
    let tableChanged = 0;
    for (const row of rows.rows) {
      const updates = [];
      const values = [];
      for (const column of columns) {
        if (needsEncryption(row[column])) {
          values.push(encryptSecret(row[column]));
          updates.push(`"${column}" = $${values.length}`);
        }
      }
      if (updates.length > 0) {
        values.push(row.id);
        await pool.query(`UPDATE "${table}" SET ${updates.join(", ")} WHERE "id" = $${values.length}`, values);
        tableChanged += updates.length;
      }
    }
    changed += tableChanged;
    console.log(`${table}: encrypted ${tableChanged} value(s) across ${rows.rowCount} row(s)`);
  }

  console.log(`Done — ${changed} value(s) encrypted${changed === 0 ? " (nothing to do)" : ""}`);
} finally {
  await pool.end();
}
