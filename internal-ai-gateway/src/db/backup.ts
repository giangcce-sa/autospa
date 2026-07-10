import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { getDb, getSqliteDatabasePath } from "./client.js";
import { listApiKeys } from "./repositories/api-keys.js";
import { listAuditLogs } from "./repositories/audit-logs.js";
import { listModelRegistry, listProviderHealthSummary } from "./repositories/model-registry.js";
import { listPolicies } from "./repositories/policies.js";
import { listRoutingRules } from "./repositories/routing-rules.js";
import { listUsageDaily } from "./repositories/usage.js";
import { listClients, listUsers } from "./repositories/users.js";

const SAFE_PATH_RE = /^[a-zA-Z0-9/_.\-]+$/;

export function createSqliteBackup(): { path: string; created_at: string; bytes: number } {
  const sourcePath = getSqliteDatabasePath();
  const createdAt = new Date().toISOString();
  const backupPath = resolve(dirname(sourcePath), "backups", `gateway-${createdAt.replaceAll(":", "-")}.db`);

  if (!SAFE_PATH_RE.test(backupPath)) {
    throw new Error(`Unsafe backup path: ${backupPath}`);
  }

  mkdirSync(dirname(backupPath), { recursive: true, mode: 0o700 });
  // VACUUM INTO does not support prepared statement placeholders — path is validated above
  getDb().exec(`VACUUM INTO '${backupPath.replaceAll("'", "''")}';`);
  const bytes = readFileSync(backupPath).byteLength;
  return {
    path: backupPath,
    created_at: createdAt,
    bytes
  };
}

export function exportDatabaseJson() {
  return {
    manifest: {
      name: "internal-ai-gateway-export",
      version: 2,
      database_provider: "sqlite",
      includes_secrets: false,
      api_keys_include_raw_key: false
    },
    exported_at: new Date().toISOString(),
    users: listUsers(),
    clients: listClients(),
    api_keys: listApiKeys(),
    policies: listPolicies(),
    routing_rules: listRoutingRules(),
    model_registry: listModelRegistry(),
    provider_health: listProviderHealthSummary(),
    audit_logs: listAuditLogs(500),
    usage_daily: listUsageDaily(500)
  };
}
