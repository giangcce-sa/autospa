import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { env } from "../config/env.js";
import { seedDatabase } from "./seed.js";

let database: DatabaseSync | undefined;

function sqlitePathFromUrl(databaseUrl: string): string {
  if (!databaseUrl.startsWith("file:")) {
    throw new Error("SQLite DATABASE_URL must start with file:");
  }

  return resolve(databaseUrl.slice("file:".length));
}

export function getSqliteDatabasePath(): string {
  return sqlitePathFromUrl(env.DATABASE_URL);
}

export function getDb(): DatabaseSync {
  if (!database) {
    if (env.DATABASE_PROVIDER !== "sqlite") {
      throw new Error("Only sqlite is implemented locally. Postgres is planned for VPS deployment.");
    }

    const dbPath = getSqliteDatabasePath();
    mkdirSync(dirname(dbPath), { recursive: true });
    database = new DatabaseSync(dbPath);
    database.exec("PRAGMA foreign_keys = ON;");
    migrateDatabase(database);
    seedDatabase(database);
  }

  return database;
}

export function closeDb(): void {
  database?.close();
  database = undefined;
}

function migrateDatabase(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'service')),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('human', 'service', 'workflow', 'spa-system', 'coding-tool')),
      owner_user_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (owner_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      client_id TEXT NOT NULL,
      name TEXT NOT NULL,
      key_prefix TEXT UNIQUE NOT NULL,
      key_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
      last_used_at TEXT,
      expires_at TEXT,
      created_at TEXT NOT NULL,
      revoked_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (client_id) REFERENCES clients(id)
    );

    CREATE TABLE IF NOT EXISTS policies (
      id TEXT PRIMARY KEY,
      scope_type TEXT NOT NULL CHECK (scope_type IN ('global', 'user', 'client', 'api_key')),
      scope_id TEXT NOT NULL,
      allowed_models TEXT NOT NULL,
      allowed_task_types TEXT NOT NULL,
      allowed_providers TEXT,
      allowed_cost_tiers TEXT,
      rate_limit_per_minute INTEGER NOT NULL,
      daily_request_limit INTEGER,
      monthly_token_limit INTEGER,
      max_input_characters INTEGER NOT NULL,
      allow_tools INTEGER NOT NULL DEFAULT 0,
      log_prompts INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (scope_type, scope_id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      user_id TEXT,
      api_key_id TEXT,
      client_id TEXT,
      model TEXT,
      provider TEXT,
      upstream_provider TEXT,
      upstream_model TEXT,
      status TEXT NOT NULL CHECK (status IN ('ok', 'error')),
      latency_ms INTEGER NOT NULL,
      input_tokens INTEGER,
      output_tokens INTEGER,
      estimated_cost REAL,
      error_code TEXT,
      exit_code INTEGER,
      timed_out INTEGER,
      working_directory TEXT,
      usage_source TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_api_key ON audit_logs(api_key_id);
    CREATE INDEX IF NOT EXISTS idx_audit_client ON audit_logs(client_id);

    CREATE TABLE IF NOT EXISTS usage_daily (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      user_id TEXT,
      api_key_id TEXT,
      client_id TEXT,
      provider TEXT,
      model TEXT,
      request_count INTEGER NOT NULL DEFAULT 0,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      estimated_cost REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (date, api_key_id, client_id, provider, model)
    );

    CREATE TABLE IF NOT EXISTS model_registry (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      provider_model TEXT NOT NULL,
      display_name TEXT NOT NULL,
      tags TEXT NOT NULL,
      task_types TEXT NOT NULL,
      priority INTEGER NOT NULL DEFAULT 50,
      enabled INTEGER NOT NULL DEFAULT 1,
      source TEXT NOT NULL DEFAULT 'scan',
      last_seen_at TEXT NOT NULL,
      last_error_at TEXT,
      avg_latency_ms INTEGER,
      error_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (provider, provider_model)
    );

    CREATE INDEX IF NOT EXISTS idx_model_registry_provider ON model_registry(provider);
    CREATE INDEX IF NOT EXISTS idx_model_registry_enabled ON model_registry(enabled);

    CREATE TABLE IF NOT EXISTS routing_rules (
      id TEXT PRIMARY KEY,
      scope_type TEXT NOT NULL CHECK (scope_type IN ('global', 'user', 'client', 'api_key')),
      scope_id TEXT NOT NULL,
      capability TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_model TEXT NOT NULL,
      model_registry_id TEXT,
      cost_tier TEXT NOT NULL DEFAULT 'balanced' CHECK (cost_tier IN ('cheap', 'balanced', 'strong')),
      priority INTEGER NOT NULL DEFAULT 50,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (scope_type, scope_id, capability, provider_model)
    );

    CREATE INDEX IF NOT EXISTS idx_routing_rules_scope ON routing_rules(scope_type, scope_id, capability, enabled);
    CREATE INDEX IF NOT EXISTS idx_routing_rules_capability ON routing_rules(capability, enabled);

    CREATE TABLE IF NOT EXISTS admin_sessions (
      token TEXT PRIMARY KEY,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);

    CREATE TABLE IF NOT EXISTS rate_limit_counters (
      api_key_id TEXT NOT NULL,
      minute_bucket INTEGER NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (api_key_id, minute_bucket)
    );

    CREATE TABLE IF NOT EXISTS public_rate_limit_counters (
      scope TEXT NOT NULL,
      identity TEXT NOT NULL,
      window_bucket INTEGER NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (scope, identity, window_bucket)
    );

    CREATE TABLE IF NOT EXISTS landing_events (
      id TEXT PRIMARY KEY,
      event_name TEXT NOT NULL,
      path TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_landing_events_created_at ON landing_events(created_at);
    CREATE INDEX IF NOT EXISTS idx_landing_events_name ON landing_events(event_name);

    CREATE TABLE IF NOT EXISTS webhooks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      events TEXT NOT NULL DEFAULT '[]',
      secret TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_triggered_at TEXT,
      last_status INTEGER,
      failure_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_webhooks_enabled ON webhooks(enabled);

    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      actor TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_admin_audit_created_at ON admin_audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_admin_audit_action ON admin_audit_logs(action);

    CREATE TABLE IF NOT EXISTS alert_cooldowns (
      event TEXT NOT NULL,
      identity TEXT NOT NULL,
      last_sent_at INTEGER NOT NULL,
      PRIMARY KEY (event, identity)
    );
  `);

  addColumnIfMissing(db, "policies", "allowed_providers", "TEXT");
  addColumnIfMissing(db, "policies", "allowed_cost_tiers", "TEXT");
  addColumnIfMissing(db, "model_registry", "model_kind", "TEXT NOT NULL DEFAULT 'chat'");
  addColumnIfMissing(db, "model_registry", "cost_tier", "TEXT NOT NULL DEFAULT 'balanced'");
  addColumnIfMissing(db, "model_registry", "health_status", "TEXT NOT NULL DEFAULT 'unknown'");

  db.prepare("INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(
    "2026-06-20-security-reliability-v2",
    new Date().toISOString()
  );
  db.prepare("INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(
    "2026-06-20-production-hardening-v3",
    new Date().toISOString()
  );
}

function addColumnIfMissing(db: DatabaseSync, table: string, column: string, definition: string): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((item) => item.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
  }
}
