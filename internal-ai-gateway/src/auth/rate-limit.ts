import { getDb } from "../db/client.js";
import { GatewayError } from "../errors/gateway-error.js";
import type { ApiKeyContext } from "../db/repositories/types.js";

export function assertPerKeyRateLimit(context: ApiKeyContext): void {
  const bucket = Math.floor(Date.now() / 60_000);
  const keyId = context.apiKey.id;
  const db = getDb();

  // Remove buckets older than the current minute
  db.prepare("DELETE FROM rate_limit_counters WHERE minute_bucket < ?").run(bucket);

  db.prepare(
    "INSERT OR IGNORE INTO rate_limit_counters (api_key_id, minute_bucket, count) VALUES (?, ?, 0)"
  ).run(keyId, bucket);

  const result = db
    .prepare(
      `UPDATE rate_limit_counters
       SET count = count + 1
       WHERE api_key_id = ? AND minute_bucket = ? AND count < ?`
    )
    .run(keyId, bucket, context.policy.rateLimitPerMinute);

  if (result.changes === 0) {
    throw new GatewayError("RATE_LIMITED", "API key rate limit exceeded", 429);
  }
}

export function clearRateLimitBuckets(): void {
  getDb().prepare("DELETE FROM rate_limit_counters").run();
}
