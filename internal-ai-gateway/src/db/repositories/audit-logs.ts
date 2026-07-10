import { nanoid } from "nanoid";
import { getDb } from "../client.js";
import type { AuditRecord } from "../../observability/audit-log.js";

export type AuditLogRow = {
  id: string;
  request_id: string;
  user_id: string | null;
  api_key_id: string | null;
  client_id: string | null;
  model: string | null;
  provider: string | null;
  upstream_provider: string | null;
  upstream_model: string | null;
  status: "ok" | "error";
  latency_ms: number;
  input_tokens: number | null;
  output_tokens: number | null;
  estimated_cost: number | null;
  error_code: string | null;
  exit_code: number | null;
  timed_out: number | null;
  working_directory: string | null;
  usage_source: string | null;
  created_at: string;
};

export function insertAuditLog(record: AuditRecord): void {
  getDb()
    .prepare(
      `INSERT INTO audit_logs
       (id, request_id, user_id, api_key_id, client_id, model, provider, upstream_provider, upstream_model, status,
        latency_ms, input_tokens, output_tokens, estimated_cost, error_code, exit_code, timed_out, working_directory,
        usage_source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      `aud_${nanoid(12)}`,
      record.request_id,
      record.user_id ?? null,
      record.api_key_id ?? null,
      record.client_id ?? null,
      record.model ?? null,
      record.provider ?? null,
      record.upstream_provider ?? null,
      record.upstream_model ?? null,
      record.status,
      record.latency_ms,
      record.input_tokens ?? null,
      record.output_tokens ?? null,
      record.estimated_cost ?? null,
      record.error_code ?? null,
      record.exit_code ?? null,
      record.timed_out == null ? null : record.timed_out ? 1 : 0,
      record.working_directory ?? null,
      record.usage_source ?? null,
      record.created_at
    );
}

export function listAuditLogs(limit = 100): AuditLogRow[] {
  return getDb()
    .prepare("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?")
    .all(Math.min(Math.max(limit, 1), 500)) as AuditLogRow[];
}

export type AuditLogFilters = {
  page?: number;
  limit?: number;
  status?: "ok" | "error";
  model?: string;
  provider?: string;
  from?: string;
  to?: string;
  userId?: string;
  apiKeyId?: string;
  clientId?: string;
};

export type PaginatedAuditLogs = {
  data: AuditLogRow[];
  total: number;
  page: number;
  limit: number;
  pages: number;
};

export function listAuditLogsPaginated(filters: AuditLogFilters = {}): PaginatedAuditLogs {
  const page = Math.max(filters.page ?? 1, 1);
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filters.status) {
    conditions.push("status = ?");
    params.push(filters.status);
  }
  if (filters.model) {
    conditions.push("model LIKE ?");
    params.push("%" + filters.model + "%");
  }
  if (filters.provider) {
    conditions.push("provider = ?");
    params.push(filters.provider);
  }
  if (filters.from) {
    conditions.push("created_at >= ?");
    params.push(filters.from);
  }
  if (filters.to) {
    conditions.push("created_at <= ?");
    params.push(filters.to + "T23:59:59Z");
  }
  if (filters.userId) {
    conditions.push("user_id = ?");
    params.push(filters.userId);
  }
  if (filters.apiKeyId) {
    conditions.push("api_key_id = ?");
    params.push(filters.apiKeyId);
  }
  if (filters.clientId) {
    conditions.push("client_id = ?");
    params.push(filters.clientId);
  }

  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

  const total = (
    getDb()
      .prepare("SELECT COUNT(*) as c FROM audit_logs " + where)
      .get(...params) as { c: number }
  ).c;
  const data = getDb()
    .prepare("SELECT * FROM audit_logs " + where + " ORDER BY created_at DESC LIMIT ? OFFSET ?")
    .all(...params, limit, offset) as AuditLogRow[];

  return { data, total, page, limit, pages: Math.ceil(total / limit) };
}

export type ProviderHealthStats = {
  provider: string;
  total: number;
  errors: number;
  success_rate: number;
  avg_latency_ms: number;
  last_error_at: string | null;
};

export function getProviderHealthStats(): ProviderHealthStats[] {
  const rows = getDb()
    .prepare(
      `SELECT
        provider,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors,
        AVG(CASE WHEN status = 'ok' THEN latency_ms ELSE NULL END) as avg_latency,
        MAX(CASE WHEN status = 'error' THEN created_at ELSE NULL END) as last_error_at
      FROM audit_logs
      WHERE provider IS NOT NULL
        AND created_at >= datetime('now', '-24 hours')
      GROUP BY provider`
    )
    .all() as Array<{
    provider: string;
    total: number;
    errors: number;
    avg_latency: number | null;
    last_error_at: string | null;
  }>;

  return rows.map((r) => ({
    provider: r.provider,
    total: r.total,
    errors: r.errors,
    success_rate: r.total > 0 ? Math.round(((r.total - r.errors) / r.total) * 100) : 100,
    avg_latency_ms: Math.round(r.avg_latency ?? 0),
    last_error_at: r.last_error_at
  }));
}
