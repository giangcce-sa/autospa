import type { DatabaseSync } from "node:sqlite";
import { env } from "../config/env.js";
import { gatewayCapabilities } from "../config/capabilities.js";
import { hashApiKey, parseApiKeyPrefix } from "./api-keys.js";

function now(): string {
  return new Date().toISOString();
}

function insertUser(db: DatabaseSync, user: { id: string; email: string; name: string; role: string }) {
  db.prepare(`
    INSERT OR IGNORE INTO users (id, email, name, role, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'active', ?, ?)
  `).run(user.id, user.email, user.name, user.role, now(), now());
}

function insertClient(db: DatabaseSync, client: { id: string; name: string; type: string; ownerUserId: string }) {
  db.prepare(`
    INSERT OR IGNORE INTO clients (id, name, type, owner_user_id, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'active', ?, ?)
  `).run(client.id, client.name, client.type, client.ownerUserId, now(), now());
}

function insertEnvKey(
  db: DatabaseSync,
  input: { id: string; name: string; rawKey?: string; userId: string; clientId: string }
) {
  if (!input.rawKey) return;

  const prefix = parseApiKeyPrefix(input.rawKey) ?? input.id.replaceAll("_", "-");
  db.prepare(`
    INSERT INTO api_keys (id, user_id, client_id, name, key_prefix, key_hash, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
    ON CONFLICT(id) DO UPDATE SET
      key_prefix = excluded.key_prefix,
      key_hash = excluded.key_hash,
      status = 'active',
      revoked_at = NULL
  `).run(input.id, input.userId, input.clientId, input.name, prefix, hashApiKey(input.rawKey), now());
}

function insertPolicy(
  db: DatabaseSync,
  policy: {
    id: string;
    scopeType: string;
    scopeId: string;
    allowedModels: string[];
    allowedTaskTypes: string[];
    allowedProviders?: string[];
    allowedCostTiers?: string[];
    rateLimitPerMinute: number;
    maxInputCharacters: number;
    allowTools: boolean;
    logPrompts: boolean;
  }
) {
  db.prepare(`
    INSERT OR IGNORE INTO policies (
      id, scope_type, scope_id, allowed_models, allowed_task_types, allowed_providers, allowed_cost_tiers,
      rate_limit_per_minute, daily_request_limit, monthly_token_limit, max_input_characters, allow_tools, log_prompts,
      created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?)
  `).run(
    policy.id,
    policy.scopeType,
    policy.scopeId,
    JSON.stringify(policy.allowedModels),
    JSON.stringify(policy.allowedTaskTypes),
    JSON.stringify(policy.allowedProviders ?? []),
    JSON.stringify(policy.allowedCostTiers ?? []),
    policy.rateLimitPerMinute,
    policy.maxInputCharacters,
    policy.allowTools ? 1 : 0,
    policy.logPrompts ? 1 : 0,
    now(),
    now()
  );
}

function appendPolicyValues(db: DatabaseSync, id: string, values: { allowedModels?: string[]; allowedTaskTypes?: string[] }): void {
  const record = db.prepare("SELECT allowed_models, allowed_task_types FROM policies WHERE id = ?").get(id) as
    | { allowed_models: string; allowed_task_types: string }
    | undefined;
  if (!record) return;

  const allowedModels = new Set<string>(JSON.parse(record.allowed_models));
  const allowedTaskTypes = new Set<string>(JSON.parse(record.allowed_task_types));
  for (const model of values.allowedModels ?? []) allowedModels.add(model);
  for (const taskType of values.allowedTaskTypes ?? []) allowedTaskTypes.add(taskType);

  db.prepare("UPDATE policies SET allowed_models = ?, allowed_task_types = ?, updated_at = ? WHERE id = ?").run(
    JSON.stringify([...allowedModels]),
    JSON.stringify([...allowedTaskTypes]),
    now(),
    id
  );
}

export function seedDatabase(db: DatabaseSync): void {
  insertUser(db, {
    id: "usr_owner",
    email: "owner@internal.local",
    name: "Gateway Owner",
    role: "owner"
  });

  const serviceUsers = [
    ["usr_claude_code", "claude-code@internal.local", "Claude Code"],
    ["usr_cursor", "cursor@internal.local", "Cursor"],
    ["usr_n8n", "n8n@internal.local", "n8n"],
    ["usr_ai_spa", "ai-spa@internal.local", "AI Spa"]
  ] as const;

  for (const [id, email, name] of serviceUsers) {
    insertUser(db, { id, email, name, role: "service" });
  }

  insertClient(db, { id: "cli_claude_code", name: "Claude Code", type: "coding-tool", ownerUserId: "usr_claude_code" });
  insertClient(db, { id: "cli_cursor", name: "Cursor", type: "coding-tool", ownerUserId: "usr_cursor" });
  insertClient(db, { id: "cli_n8n", name: "n8n", type: "workflow", ownerUserId: "usr_n8n" });
  insertClient(db, { id: "cli_ai_spa", name: "AI Spa", type: "spa-system", ownerUserId: "usr_ai_spa" });

  insertEnvKey(db, {
    id: "key_claude_code_env",
    name: "Claude Code env seed",
    rawKey: env.CLAUDE_CODE_GATEWAY_KEY,
    userId: "usr_claude_code",
    clientId: "cli_claude_code"
  });
  insertEnvKey(db, {
    id: "key_cursor_env",
    name: "Cursor env seed",
    rawKey: env.CURSOR_GATEWAY_KEY,
    userId: "usr_cursor",
    clientId: "cli_cursor"
  });
  insertEnvKey(db, {
    id: "key_n8n_env",
    name: "n8n env seed",
    rawKey: env.N8N_GATEWAY_KEY,
    userId: "usr_n8n",
    clientId: "cli_n8n"
  });
  insertEnvKey(db, {
    id: "key_ai_spa_env",
    name: "AI Spa env seed",
    rawKey: env.AI_SPA_GATEWAY_KEY,
    userId: "usr_ai_spa",
    clientId: "cli_ai_spa"
  });

  insertPolicy(db, {
    id: "pol_global",
    scopeType: "global",
    scopeId: "global",
    allowedModels: ["auto", "claude-sonnet", "gpt-4.1-mini", "kiro-pro", "cheap-chat", "strong-code", "spa-assistant", "cx/gpt-5.5", "cx/gpt-5.5-review", "cx/gpt-5.4", "cx/gpt-5.4-mini"],
    allowedTaskTypes: [...gatewayCapabilities],
    rateLimitPerMinute: 120,
    maxInputCharacters: 120_000,
    allowTools: false,
    logPrompts: false
  });

  insertPolicy(db, {
    id: "pol_ai_spa_client",
    scopeType: "client",
    scopeId: "cli_ai_spa",
    allowedModels: ["auto", "gpt-4.1-mini", "claude-sonnet", "cheap-chat", "spa-assistant", "cx/gpt-5.5", "cx/gpt-5.4", "cx/gpt-5.4-mini"],
    allowedTaskTypes: ["chat", "spa-chat", "image-generation", "image-edit", "vision"],
    rateLimitPerMinute: 120,
    maxInputCharacters: 30_000,
    allowTools: false,
    logPrompts: false
  });

  appendPolicyValues(db, "pol_global", {
    allowedModels: ["auto", "cx/gpt-5.5", "cx/gpt-5.5-review", "cx/gpt-5.4", "cx/gpt-5.4-mini"],
    allowedTaskTypes: [...gatewayCapabilities]
  });
  appendPolicyValues(db, "pol_ai_spa_client", {
    allowedModels: ["auto", "cx/gpt-5.5", "cx/gpt-5.4", "cx/gpt-5.4-mini"],
    allowedTaskTypes: ["chat", "spa-chat", "image-generation", "image-edit", "vision"]
  });
}
