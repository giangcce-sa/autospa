import { getDb } from "../client.js";
import type { ProviderName } from "../../config/models.js";
import type { TaskType } from "../../providers/types.js";
import { isTextCapability } from "../../config/capabilities.js";

export type ModelRegistryRecord = {
  id: string;
  provider: ProviderName;
  provider_model: string;
  display_name: string;
  model_kind: string;
  tags: string;
  task_types: string;
  cost_tier: "cheap" | "balanced" | "strong";
  priority: number;
  enabled: number;
  source: string;
  health_status: "unknown" | "healthy" | "degraded" | "down";
  last_seen_at: string;
  last_error_at: string | null;
  avg_latency_ms: number | null;
  error_count: number;
  created_at: string;
  updated_at: string;
};

export type ModelRegistryView = Omit<ModelRegistryRecord, "tags" | "task_types" | "enabled"> & {
  tags: string[];
  task_types: TaskType[];
  enabled: boolean;
};

export type ScannedProviderModel = {
  id: string;
  displayName?: string;
  kind?: string;
};

function now(): string {
  return new Date().toISOString();
}

function parseJsonArray<T extends string>(value: string): T[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toView(record: ModelRegistryRecord): ModelRegistryView {
  return {
    ...record,
    tags: parseJsonArray(record.tags),
    task_types: parseJsonArray<TaskType>(record.task_types),
    enabled: Boolean(record.enabled)
  };
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function classifyModel(providerModel: string, kind = "chat"): { tags: string[]; taskTypes: TaskType[]; priority: number; costTier: "cheap" | "balanced" | "strong" } {
  const model = providerModel.toLowerCase();
  const tags: string[] = [];
  const taskTypes: TaskType[] = kind === "chat" || kind === "web" ? ["chat"] : [];
  let priority = 50;
  let costTier: "cheap" | "balanced" | "strong" = "balanced";

  if (/coder|code|dev|swe|program/.test(model)) {
    tags.push("coding");
    taskTypes.push("coding", "review", "test-generation", "repo-analysis");
    priority += 30;
  }

  if (/claude|sonnet|opus|gpt-4|gpt-5|qwen3-coder|max|plus|pro/.test(model)) {
    tags.push("strong");
    priority += 15;
    costTier = "strong";
  }

  if (/glm|mini|flash|haiku|cheap|lite|turbo/.test(model)) {
    tags.push("cheap", "fast");
    priority += 8;
    costTier = "cheap";
  }

  if (/(^|[/_-])spa($|[/_-])|customer|assistant/.test(model)) {
    tags.push("spa");
    taskTypes.push("spa-chat");
    priority += 10;
  }

  if (kind === "image" || /image|img|flux|stable-diffusion|sdxl|dall-e|midjourney|mj|ideogram|recraft/.test(model)) {
    tags.push("image");
    taskTypes.push("image-generation");
    priority += 20;
  }

  if (/edit|inpaint|outpaint/.test(model) && tags.includes("image")) {
    taskTypes.push("image-edit");
  }

  if (kind === "image-to-text" || /vision|vl|gpt-4o|qwen-vl|multimodal/.test(model)) {
    tags.push("vision");
    taskTypes.push("vision");
    priority += 10;
  }

  if (kind === "embedding" || /embed|embedding/.test(model)) {
    tags.push("embedding", "non-chat");
    taskTypes.push("embedding");
    priority -= 50;
  }

  if (/rerank/.test(model)) {
    tags.push("rerank", "non-chat");
    taskTypes.push("rerank");
    priority -= 50;
  }

  if (kind === "tts" || /tts|text-to-speech|speech/.test(model)) {
    tags.push("audio");
    taskTypes.push("text-to-speech");
  }

  if (kind === "stt" || /whisper|transcri|speech-to-text|stt/.test(model)) {
    tags.push("audio");
    taskTypes.push("speech-to-text");
  }

  if (kind === "web") {
    tags.push("web");
    taskTypes.push("workflow");
  }

  return {
    tags: unique(tags),
    taskTypes: unique(taskTypes),
    priority: Math.max(0, priority),
    costTier
  };
}

export function upsertScannedModels(provider: ProviderName, models: ScannedProviderModel[]): ModelRegistryView[] {
  const db = getDb();
  const timestamp = now();
  const upsert = db.prepare(`
    INSERT INTO model_registry (
      id, provider, provider_model, display_name, model_kind, tags, task_types, cost_tier, priority, enabled, source, health_status,
      last_seen_at, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'scan', 'unknown', ?, ?, ?)
    ON CONFLICT(provider, provider_model) DO UPDATE SET
      display_name = excluded.display_name,
      model_kind = excluded.model_kind,
      tags = excluded.tags,
      task_types = excluded.task_types,
      cost_tier = excluded.cost_tier,
      priority = CASE
        WHEN model_registry.source = 'manual' THEN model_registry.priority
        ELSE excluded.priority
      END,
      last_seen_at = excluded.last_seen_at,
      updated_at = excluded.updated_at
  `);

  for (const model of models) {
    const classification = classifyModel(model.id, model.kind ?? "chat");
    upsert.run(
      `${provider}:${model.id}`,
      provider,
      model.id,
      model.displayName ?? model.id,
      model.kind ?? "chat",
      JSON.stringify(classification.tags),
      JSON.stringify(classification.taskTypes),
      classification.costTier,
      classification.priority,
      timestamp,
      timestamp,
      timestamp
    );
  }

  return listModelRegistry({ provider });
}

export function listModelRegistry(input: { provider?: ProviderName; enabledOnly?: boolean } = {}): ModelRegistryView[] {
  const db = getDb();
  const clauses: string[] = [];
  const params: string[] = [];

  if (input.provider) {
    clauses.push("provider = ?");
    params.push(input.provider);
  }

  if (input.enabledOnly) {
    clauses.push("enabled = 1");
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db
    .prepare(`SELECT * FROM model_registry ${where} ORDER BY enabled DESC, priority DESC, provider_model ASC`)
    .all(...params) as ModelRegistryRecord[];

  return rows.map(toView);
}

export function updateModelRegistry(
  id: string,
  input: { enabled?: boolean; priority?: number; taskTypes?: TaskType[]; tags?: string[] }
): ModelRegistryView | null {
  const current = getDb().prepare("SELECT * FROM model_registry WHERE id = ?").get(id) as ModelRegistryRecord | undefined;
  if (!current) return null;

  const updated = {
    enabled: input.enabled == null ? current.enabled : input.enabled ? 1 : 0,
    priority: input.priority ?? current.priority,
    taskTypes: input.taskTypes ?? parseJsonArray<TaskType>(current.task_types),
    tags: input.tags ?? parseJsonArray(current.tags)
  };

  getDb()
    .prepare(
      `UPDATE model_registry
       SET enabled = ?, priority = ?, task_types = ?, tags = ?, source = 'manual', updated_at = ?
       WHERE id = ?`
    )
    .run(updated.enabled, updated.priority, JSON.stringify(updated.taskTypes), JSON.stringify(updated.tags), now(), id);

  const record = getDb().prepare("SELECT * FROM model_registry WHERE id = ?").get(id) as ModelRegistryRecord;
  return toView(record);
}

export function updateProviderModels(
  provider: ProviderName,
  input: { enabled?: boolean; priority?: number }
): { updated: number; models: ModelRegistryView[] } {
  const updates: string[] = [];
  const params: Array<string | number> = [];

  if (input.enabled != null) {
    updates.push("enabled = ?");
    params.push(input.enabled ? 1 : 0);
  }

  if (input.priority != null) {
    updates.push("priority = ?");
    params.push(input.priority);
  }

  if (!updates.length) {
    return { updated: 0, models: listModelRegistry({ provider }) };
  }

  updates.push("source = 'manual'", "updated_at = ?");
  params.push(now(), provider);

  const result = getDb()
    .prepare(`UPDATE model_registry SET ${updates.join(", ")} WHERE provider = ?`)
    .run(...params);

  return { updated: Number(result.changes ?? 0), models: listModelRegistry({ provider }) };
}

export function updateModelHealth(
  id: string,
  input: { healthStatus: "unknown" | "healthy" | "degraded" | "down"; avgLatencyMs?: number | null; errorCount?: number; lastErrorAt?: string | null }
): ModelRegistryView | null {
  const current = getDb().prepare("SELECT * FROM model_registry WHERE id = ?").get(id) as ModelRegistryRecord | undefined;
  if (!current) return null;

  getDb()
    .prepare(
      `UPDATE model_registry
       SET health_status = ?, avg_latency_ms = ?, error_count = ?, last_error_at = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(
      input.healthStatus,
      input.avgLatencyMs ?? current.avg_latency_ms,
      input.errorCount ?? current.error_count,
      input.lastErrorAt ?? current.last_error_at,
      now(),
      id
    );

  const record = getDb().prepare("SELECT * FROM model_registry WHERE id = ?").get(id) as ModelRegistryRecord;
  return toView(record);
}

export function listProviderHealthSummary(): Array<{
  provider: ProviderName;
  total: number;
  enabled: number;
  healthy: number;
  degraded: number;
  down: number;
  unknown: number;
  avg_latency_ms: number | null;
  error_count: number;
}> {
  return getDb()
    .prepare(
      `SELECT
         provider,
         COUNT(*) AS total,
         SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) AS enabled,
         SUM(CASE WHEN health_status = 'healthy' THEN 1 ELSE 0 END) AS healthy,
         SUM(CASE WHEN health_status = 'degraded' THEN 1 ELSE 0 END) AS degraded,
         SUM(CASE WHEN health_status = 'down' THEN 1 ELSE 0 END) AS down,
         SUM(CASE WHEN health_status = 'unknown' THEN 1 ELSE 0 END) AS unknown,
         CAST(AVG(avg_latency_ms) AS INTEGER) AS avg_latency_ms,
         SUM(error_count) AS error_count
       FROM model_registry
       GROUP BY provider
       ORDER BY provider`
    )
    .all() as Array<{
    provider: ProviderName;
    total: number;
    enabled: number;
    healthy: number;
    degraded: number;
    down: number;
    unknown: number;
    avg_latency_ms: number | null;
    error_count: number;
  }>;
}

export function selectBestModelForTask(taskType: TaskType, allowedGatewayModels: string[]): ModelRegistryView | null {
  const allowsAuto =
    allowedGatewayModels.includes("auto") ||
    allowedGatewayModels.includes("cheap-chat") ||
    allowedGatewayModels.includes("strong-code") ||
    allowedGatewayModels.includes("spa-assistant");

  if (!allowsAuto) return null;

  const candidates = listModelRegistry({ provider: "9router", enabledOnly: true }).filter((model) => {
    if (!model.task_types.includes(taskType)) return false;
    if (isTextCapability(taskType) && model.tags.includes("non-chat")) return false;
    return true;
  });

  return candidates[0] ?? null;
}
