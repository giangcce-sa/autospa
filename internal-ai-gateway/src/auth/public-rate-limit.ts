import { getDb } from "../db/client.js";

export function incrementPublicRateLimit(input: {
  scope: string;
  identity: string;
  windowMs: number;
  max: number;
}): boolean {
  const bucket = Math.floor(Date.now() / input.windowMs);
  const db = getDb();
  db.prepare("DELETE FROM public_rate_limit_counters WHERE scope = ? AND window_bucket < ?").run(input.scope, bucket);
  db.prepare(
    "INSERT OR IGNORE INTO public_rate_limit_counters (scope, identity, window_bucket, count) VALUES (?, ?, ?, 0)"
  ).run(input.scope, input.identity, bucket);

  const result = db
    .prepare(
      `UPDATE public_rate_limit_counters
       SET count = count + 1
       WHERE scope = ? AND identity = ? AND window_bucket = ? AND count < ?`
    )
    .run(input.scope, input.identity, bucket, input.max);

  return Number(result.changes ?? 0) > 0;
}

export function isPublicRateLimitBlocked(input: {
  scope: string;
  identity: string;
  windowMs: number;
  max: number;
}): boolean {
  const bucket = Math.floor(Date.now() / input.windowMs);
  const row = getDb()
    .prepare(
      `SELECT count FROM public_rate_limit_counters
       WHERE scope = ? AND identity = ? AND window_bucket = ?`
    )
    .get(input.scope, input.identity, bucket) as { count: number } | undefined;
  return (row?.count ?? 0) >= input.max;
}

export function clearPublicRateLimit(scope: string, identity: string): void {
  getDb()
    .prepare("DELETE FROM public_rate_limit_counters WHERE scope = ? AND identity = ?")
    .run(scope, identity);
}
