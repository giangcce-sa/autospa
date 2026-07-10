import { nanoid } from "nanoid";
import { getDb } from "../client.js";
import type { PolicyRecord, ResolvedPolicy } from "./types.js";

function now(): string {
  return new Date().toISOString();
}

function parseArray(value: string): string[] {
  const parsed = JSON.parse(value) as unknown;
  return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
}

function toResolved(record: PolicyRecord): ResolvedPolicy {
  return {
    allowedModels: parseArray(record.allowed_models),
    allowedTaskTypes: parseArray(record.allowed_task_types),
    allowedProviders: parseArray(record.allowed_providers ?? "[]"),
    allowedCostTiers: parseArray(record.allowed_cost_tiers ?? "[]"),
    rateLimitPerMinute: record.rate_limit_per_minute,
    dailyRequestLimit: record.daily_request_limit,
    monthlyTokenLimit: record.monthly_token_limit,
    maxInputCharacters: record.max_input_characters,
    allowTools: Boolean(record.allow_tools),
    logPrompts: Boolean(record.log_prompts),
    source: `${record.scope_type}:${record.scope_id}`
  };
}

export function listPolicies(): PolicyRecord[] {
  return getDb().prepare("SELECT * FROM policies ORDER BY scope_type, scope_id").all() as PolicyRecord[];
}

export function upsertPolicy(input: {
  scopeType: "global" | "user" | "client" | "api_key";
  scopeId: string;
  allowedModels: string[];
  allowedTaskTypes: string[];
  allowedProviders?: string[];
  allowedCostTiers?: string[];
  rateLimitPerMinute: number;
  dailyRequestLimit?: number | null;
  monthlyTokenLimit?: number | null;
  maxInputCharacters: number;
  allowTools: boolean;
  logPrompts: boolean;
}): PolicyRecord {
  const existing = getDb()
    .prepare("SELECT * FROM policies WHERE scope_type = ? AND scope_id = ?")
    .get(input.scopeType, input.scopeId) as PolicyRecord | undefined;

  if (existing) {
    getDb()
      .prepare(
        `UPDATE policies
         SET allowed_models = ?, allowed_task_types = ?, allowed_providers = ?, allowed_cost_tiers = ?,
             rate_limit_per_minute = ?, daily_request_limit = ?,
             monthly_token_limit = ?, max_input_characters = ?, allow_tools = ?, log_prompts = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        JSON.stringify(input.allowedModels),
        JSON.stringify(input.allowedTaskTypes),
        JSON.stringify(input.allowedProviders ?? []),
        JSON.stringify(input.allowedCostTiers ?? []),
        input.rateLimitPerMinute,
        input.dailyRequestLimit ?? null,
        input.monthlyTokenLimit ?? null,
        input.maxInputCharacters,
        input.allowTools ? 1 : 0,
        input.logPrompts ? 1 : 0,
        now(),
        existing.id
      );
    return getDb().prepare("SELECT * FROM policies WHERE id = ?").get(existing.id) as PolicyRecord;
  }

  const id = `pol_${nanoid(10)}`;
  getDb()
    .prepare(
      `INSERT INTO policies
       (id, scope_type, scope_id, allowed_models, allowed_task_types, allowed_providers, allowed_cost_tiers,
        rate_limit_per_minute, daily_request_limit,
        monthly_token_limit, max_input_characters, allow_tools, log_prompts, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      input.scopeType,
      input.scopeId,
      JSON.stringify(input.allowedModels),
      JSON.stringify(input.allowedTaskTypes),
      JSON.stringify(input.allowedProviders ?? []),
      JSON.stringify(input.allowedCostTiers ?? []),
      input.rateLimitPerMinute,
      input.dailyRequestLimit ?? null,
      input.monthlyTokenLimit ?? null,
      input.maxInputCharacters,
      input.allowTools ? 1 : 0,
      input.logPrompts ? 1 : 0,
      now(),
      now()
    );

  return getDb().prepare("SELECT * FROM policies WHERE id = ?").get(id) as PolicyRecord;
}

export function resolvePolicyForContext(input: { apiKeyId: string; clientId: string; userId: string }): ResolvedPolicy {
  // Single query: fetch all matching policies, ordered by priority (api_key > client > user > global)
  const policy = getDb()
    .prepare(
      `SELECT *, CASE scope_type
         WHEN 'api_key' THEN 1
         WHEN 'client'  THEN 2
         WHEN 'user'    THEN 3
         WHEN 'global'  THEN 4
       END AS _priority
       FROM policies
       WHERE (scope_type = 'api_key' AND scope_id = ?)
          OR (scope_type = 'client'  AND scope_id = ?)
          OR (scope_type = 'user'    AND scope_id = ?)
          OR (scope_type = 'global'  AND scope_id = 'global')
       ORDER BY _priority
       LIMIT 1`
    )
    .get(input.apiKeyId, input.clientId, input.userId) as PolicyRecord | undefined;

  if (policy) {
    return toResolved(policy);
  }

  return {
    allowedModels: [],
    allowedTaskTypes: [],
    allowedProviders: [],
    allowedCostTiers: [],
    rateLimitPerMinute: 1,
    dailyRequestLimit: null,
    monthlyTokenLimit: null,
    maxInputCharacters: 1000,
    allowTools: false,
    logPrompts: false,
    source: "fallback"
  };
}
