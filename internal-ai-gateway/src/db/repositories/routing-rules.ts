import { nanoid } from "nanoid";
import type { GatewayCapability } from "../../config/capabilities.js";
import type { ProviderName } from "../../config/models.js";
import { getDb } from "../client.js";

export type RoutingRuleRecord = {
  id: string;
  scope_type: "global" | "user" | "client" | "api_key";
  scope_id: string;
  capability: GatewayCapability;
  provider: ProviderName;
  provider_model: string;
  model_registry_id: string | null;
  cost_tier: "cheap" | "balanced" | "strong";
  priority: number;
  enabled: number;
  created_at: string;
  updated_at: string;
};

export type RoutingRuleInput = {
  scopeType: RoutingRuleRecord["scope_type"];
  scopeId: string;
  capability: GatewayCapability;
  provider: ProviderName;
  providerModel: string;
  modelRegistryId?: string | null;
  costTier?: RoutingRuleRecord["cost_tier"];
  priority?: number;
  enabled?: boolean;
};

function now(): string {
  return new Date().toISOString();
}

export function listRoutingRules(): RoutingRuleRecord[] {
  return getDb()
    .prepare(
      `SELECT * FROM routing_rules
       ORDER BY enabled DESC,
         CASE scope_type WHEN 'api_key' THEN 1 WHEN 'client' THEN 2 WHEN 'user' THEN 3 ELSE 4 END,
         capability ASC, priority DESC`
    )
    .all() as RoutingRuleRecord[];
}

export function upsertRoutingRule(input: RoutingRuleInput): RoutingRuleRecord {
  const timestamp = now();
  const existing = getDb()
    .prepare(
      `SELECT * FROM routing_rules
       WHERE scope_type = ? AND scope_id = ? AND capability = ? AND provider_model = ?`
    )
    .get(input.scopeType, input.scopeId, input.capability, input.providerModel) as RoutingRuleRecord | undefined;

  if (existing) {
    getDb()
      .prepare(
        `UPDATE routing_rules
         SET provider = ?, model_registry_id = ?, cost_tier = ?, priority = ?, enabled = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        input.provider,
        input.modelRegistryId ?? null,
        input.costTier ?? existing.cost_tier,
        input.priority ?? existing.priority,
        input.enabled == null ? existing.enabled : input.enabled ? 1 : 0,
        timestamp,
        existing.id
      );
    return getDb().prepare("SELECT * FROM routing_rules WHERE id = ?").get(existing.id) as RoutingRuleRecord;
  }

  const id = `rr_${nanoid(10)}`;
  getDb()
    .prepare(
      `INSERT INTO routing_rules
       (id, scope_type, scope_id, capability, provider, provider_model, model_registry_id, cost_tier, priority, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      input.scopeType,
      input.scopeId,
      input.capability,
      input.provider,
      input.providerModel,
      input.modelRegistryId ?? null,
      input.costTier ?? "balanced",
      input.priority ?? 50,
      input.enabled ?? true ? 1 : 0,
      timestamp,
      timestamp
    );

  return getDb().prepare("SELECT * FROM routing_rules WHERE id = ?").get(id) as RoutingRuleRecord;
}

export function selectRoutingRuleForContext(input: {
  apiKeyId: string;
  clientId: string;
  userId: string;
  capability: GatewayCapability;
}): RoutingRuleRecord | null {
  const row = getDb()
    .prepare(
      `SELECT *, CASE scope_type
         WHEN 'api_key' THEN 1
         WHEN 'client' THEN 2
         WHEN 'user' THEN 3
         ELSE 4
       END AS _scope_priority
       FROM routing_rules
       WHERE enabled = 1
         AND capability = ?
         AND (
           (scope_type = 'api_key' AND scope_id = ?)
           OR (scope_type = 'client' AND scope_id = ?)
           OR (scope_type = 'user' AND scope_id = ?)
           OR (scope_type = 'global' AND scope_id = 'global')
         )
       ORDER BY _scope_priority ASC, priority DESC
       LIMIT 1`
    )
    .get(input.capability, input.apiKeyId, input.clientId, input.userId) as RoutingRuleRecord | undefined;

  return row ?? null;
}
