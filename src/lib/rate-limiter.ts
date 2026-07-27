import { prisma } from "./db";
import { quotaFromBucket, retryAfterDelaySec } from "./rate-limit-policy";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
  used: number;
  limit: number;
}

/**
 * Check + increment a rate-limit bucket in a single atomic statement.
 * Every request gets a unique count within the window, so exactly `limit`
 * concurrent requests are admitted — no read-then-write race.
 * A blocked request still increments `count` (never `windowStart`), so
 * `used` can exceed `limit` under pressure while the window expiry is unchanged.
 *
 * @param key - bucket identifier like "fb:page_123" or "zalo:oa_456"
 * @param limit - max requests per window
 * @param windowSec - window length in seconds
 */
export async function checkAndIncrement(
  key: string,
  limit: number,
  windowSec: number
): Promise<RateLimitResult> {
  const now = new Date();
  const expiredBefore = new Date(now.getTime() - windowSec * 1000);

  const rows = await prisma.$queryRaw<Array<{ count: number; windowStart: Date }>>`
    INSERT INTO "RateLimit" ("id", "count", "windowStart", "limit", "windowSec", "updatedAt")
    VALUES (${key}, 1, ${now}, ${limit}, ${windowSec}, ${now})
    ON CONFLICT ("id") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimit"."windowStart" <= ${expiredBefore} THEN 1
        ELSE "RateLimit"."count" + 1
      END,
      "windowStart" = CASE
        WHEN "RateLimit"."windowStart" <= ${expiredBefore} THEN ${now}
        ELSE "RateLimit"."windowStart"
      END,
      "limit" = ${limit},
      "windowSec" = ${windowSec},
      "updatedAt" = ${now}
    RETURNING "count", "windowStart"
  `;

  const row = rows[0];
  const used = Number(row.count);
  const allowed = used <= limit;

  return {
    allowed,
    remaining: Math.max(0, limit - used),
    retryAfterSec: allowed ? 0 : retryAfterDelaySec(row.windowStart, windowSec, now),
    used,
    limit,
  };
}

/**
 * Clear a bucket entirely (e.g. reset login-failure counters after success).
 */
export async function resetBucket(key: string): Promise<void> {
  await prisma.rateLimit.deleteMany({ where: { id: key } });
}

/**
 * Wrap an async function with rate limiting.
 * If allowed → run. If not → wait retryAfterSec then retry once.
 * If still not allowed after retry → throw.
 */
export async function withRateLimit<T>(
  key: string,
  limit: number,
  windowSec: number,
  fn: () => Promise<T>
): Promise<T> {
  const check = await checkAndIncrement(key, limit, windowSec);

  if (check.allowed) {
    return fn();
  }

  // Wait once (capped at 30s to avoid blocking serverless function)
  const waitMs = Math.min(check.retryAfterSec, 30) * 1000;
  await new Promise((resolve) => setTimeout(resolve, waitMs));

  const retry = await checkAndIncrement(key, limit, windowSec);
  if (!retry.allowed) {
    throw new Error(`RATE_LIMITED: ${key} (${check.used}/${limit} per ${windowSec}s, retry after ${check.retryAfterSec}s)`);
  }

  return fn();
}

/**
 * Get current quota status for a key (without incrementing).
 */
export async function getQuotaStatus(key: string): Promise<{
  used: number;
  limit: number;
  remaining: number;
  windowEndsIn: number;
  pct: number;
} | null> {
  const record = await prisma.rateLimit.findUnique({ where: { id: key } });
  if (!record) return null;

  return quotaFromBucket(record, new Date());
}

/**
 * Get all active rate limit buckets (for dashboard).
 */
export async function getAllQuotas(): Promise<Array<{ key: string; used: number; limit: number; pct: number; windowEndsIn: number }>> {
  const records = await prisma.rateLimit.findMany({ orderBy: { updatedAt: "desc" }, take: 20 });
  const now = new Date();
  return records.map((r) => {
    const quota = quotaFromBucket(r, now);
    return {
      key: r.id,
      used: quota.used,
      limit: quota.limit,
      pct: quota.pct,
      windowEndsIn: quota.windowEndsIn,
    };
  });
}
