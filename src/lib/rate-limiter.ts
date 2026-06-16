import { prisma } from "./db";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
  used: number;
  limit: number;
}

/**
 * Check + increment a rate-limit bucket atomically (best-effort with read-then-write).
 * Returns whether request is allowed and how many used/remaining.
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

  const existing = await prisma.rateLimit.findUnique({ where: { id: key } });

  let count = 0;
  let windowStart = now;

  if (existing) {
    const ageSec = (now.getTime() - existing.windowStart.getTime()) / 1000;
    if (ageSec >= windowSec) {
      // Window expired — reset
      count = 0;
      windowStart = now;
    } else {
      count = existing.count;
      windowStart = existing.windowStart;
    }
  }

  if (count >= limit) {
    const ageSec = (now.getTime() - windowStart.getTime()) / 1000;
    const retryAfterSec = Math.max(1, Math.ceil(windowSec - ageSec));
    return { allowed: false, remaining: 0, retryAfterSec, used: count, limit };
  }

  const newCount = count + 1;

  await prisma.rateLimit.upsert({
    where: { id: key },
    create: {
      id: key,
      count: newCount,
      windowStart,
      limit,
      windowSec,
    },
    update: {
      count: newCount,
      windowStart,
      limit,
      windowSec,
    },
  });

  return {
    allowed: true,
    remaining: limit - newCount,
    retryAfterSec: 0,
    used: newCount,
    limit,
  };
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

  const ageSec = (Date.now() - record.windowStart.getTime()) / 1000;
  if (ageSec >= record.windowSec) {
    return {
      used: 0,
      limit: record.limit,
      remaining: record.limit,
      windowEndsIn: 0,
      pct: 0,
    };
  }

  return {
    used: record.count,
    limit: record.limit,
    remaining: Math.max(0, record.limit - record.count),
    windowEndsIn: Math.ceil(record.windowSec - ageSec),
    pct: Math.round((record.count / record.limit) * 100),
  };
}

/**
 * Get all active rate limit buckets (for dashboard).
 */
export async function getAllQuotas(): Promise<Array<{ key: string; used: number; limit: number; pct: number; windowEndsIn: number }>> {
  const records = await prisma.rateLimit.findMany({ orderBy: { updatedAt: "desc" }, take: 20 });
  const now = Date.now();
  return records
    .map((r) => {
      const ageSec = (now - r.windowStart.getTime()) / 1000;
      const active = ageSec < r.windowSec;
      const used = active ? r.count : 0;
      return {
        key: r.id,
        used,
        limit: r.limit,
        pct: Math.round((used / r.limit) * 100),
        windowEndsIn: active ? Math.ceil(r.windowSec - ageSec) : 0,
      };
    });
}
