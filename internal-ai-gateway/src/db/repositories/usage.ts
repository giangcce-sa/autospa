import { nanoid } from "nanoid";
import { getDb } from "../client.js";
import type { AuditRecord } from "../../observability/audit-log.js";

function dayKey(isoDate: string): string {
  return isoDate.slice(0, 10);
}

export function incrementUsage(record: AuditRecord): void {
  if (record.status !== "ok") return;

  const date = dayKey(record.created_at);
  const existing = getDb()
    .prepare(
      `SELECT id FROM usage_daily
       WHERE date = ? AND api_key_id IS ? AND client_id IS ? AND provider IS ? AND model IS ?`
    )
    .get(date, record.api_key_id ?? null, record.client_id ?? null, record.provider ?? null, record.model ?? null) as
    | { id: string }
    | undefined;

  const inputTokens = record.input_tokens ?? 0;
  const outputTokens = record.output_tokens ?? 0;
  const estimatedCost = record.estimated_cost ?? 0;
  const now = new Date().toISOString();

  if (existing) {
    getDb()
      .prepare(
        `UPDATE usage_daily
         SET request_count = request_count + 1,
             input_tokens = input_tokens + ?,
             output_tokens = output_tokens + ?,
             estimated_cost = estimated_cost + ?,
             updated_at = ?
         WHERE id = ?`
      )
      .run(inputTokens, outputTokens, estimatedCost, now, existing.id);
    return;
  }

  getDb()
    .prepare(
      `INSERT INTO usage_daily
       (id, date, user_id, api_key_id, client_id, provider, model, request_count, input_tokens, output_tokens,
        estimated_cost, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`
    )
    .run(
      `use_${nanoid(12)}`,
      date,
      record.user_id ?? null,
      record.api_key_id ?? null,
      record.client_id ?? null,
      record.provider ?? null,
      record.model ?? null,
      inputTokens,
      outputTokens,
      estimatedCost,
      now,
      now
    );
}

export function listUsageDaily(limit = 100) {
  return getDb()
    .prepare("SELECT * FROM usage_daily ORDER BY date DESC, updated_at DESC LIMIT ?")
    .all(Math.min(Math.max(limit, 1), 500));
}

export function getUsageSummary(input: { days?: number; groupBy?: "date" | "client" | "model" | "provider" } = {}) {
  const days = Math.min(Math.max(input.days ?? 7, 1), 90);
  const groupBy = input.groupBy ?? "date";
  const since = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const groupColumn =
    groupBy === "client" ? "client_id" : groupBy === "model" ? "model" : groupBy === "provider" ? "provider" : "date";

  return getDb()
    .prepare(
      `SELECT
         ${groupColumn} AS bucket,
         COALESCE(SUM(request_count), 0) AS request_count,
         COALESCE(SUM(input_tokens), 0) AS input_tokens,
         COALESCE(SUM(output_tokens), 0) AS output_tokens,
         COALESCE(SUM(estimated_cost), 0) AS estimated_cost
       FROM usage_daily
       WHERE date >= ?
       GROUP BY ${groupColumn}
       ORDER BY request_count DESC, bucket ASC`
    )
    .all(since);
}

export function getApiKeyUsage(apiKeyId: string, days = 30) {
  const boundedDays = Math.min(Math.max(days, 1), 90);
  const since = new Date(Date.now() - (boundedDays - 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const rows = getDb()
    .prepare(
      `SELECT *
       FROM usage_daily
       WHERE api_key_id = ? AND date >= ?
       ORDER BY date DESC, updated_at DESC`
    )
    .all(apiKeyId, since) as Array<{
    request_count: number;
    input_tokens: number;
    output_tokens: number;
    estimated_cost: number;
  }>;

  return {
    api_key_id: apiKeyId,
    days: boundedDays,
    totals: rows.reduce(
      (sum, row) => ({
        request_count: sum.request_count + row.request_count,
        input_tokens: sum.input_tokens + row.input_tokens,
        output_tokens: sum.output_tokens + row.output_tokens,
        estimated_cost: Number((sum.estimated_cost + row.estimated_cost).toFixed(8))
      }),
      { request_count: 0, input_tokens: 0, output_tokens: 0, estimated_cost: 0 }
    ),
    rows
  };
}

export function getApiKeyUsageSince(apiKeyId: string, since: string) {
  return getDb()
    .prepare(
      `SELECT
         COALESCE(SUM(request_count), 0) AS request_count,
         COALESCE(SUM(input_tokens), 0) AS input_tokens,
         COALESCE(SUM(output_tokens), 0) AS output_tokens,
         COALESCE(SUM(estimated_cost), 0) AS estimated_cost
       FROM usage_daily
       WHERE api_key_id = ? AND date >= ?`
    )
    .get(apiKeyId, since) as {
    request_count: number;
    input_tokens: number;
    output_tokens: number;
    estimated_cost: number;
  };
}

export function getDailyRequestCountForApiKey(apiKeyId: string, date = new Date().toISOString().slice(0, 10)): number {
  const row = getDb()
    .prepare("SELECT COALESCE(SUM(request_count), 0) AS total FROM usage_daily WHERE api_key_id = ? AND date = ?")
    .get(apiKeyId, date) as { total: number };
  return row.total;
}

export function getMonthlyTokenCountForUser(userId: string, month = new Date().toISOString().slice(0, 7)): number {
  const row = getDb()
    .prepare(
      `SELECT COALESCE(SUM(input_tokens + output_tokens), 0) AS total
       FROM usage_daily
       WHERE user_id = ? AND date >= ? AND date < ?`
    )
    .get(userId, `${month}-01`, nextMonth(month)) as { total: number };
  return row.total;
}

function nextMonth(month: string): string {
  const [yearRaw, monthRaw] = month.split("-");
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw);
  const next = new Date(Date.UTC(year, monthIndex, 1));
  return next.toISOString().slice(0, 10);
}
