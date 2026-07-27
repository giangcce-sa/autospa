// Pure window math for the RateLimit bucket model — no prisma, importable from tests.

export function windowAgeSec(windowStart: Date, now: Date): number {
  return (now.getTime() - windowStart.getTime()) / 1000;
}

export function isWindowExpired(windowStart: Date, windowSec: number, now: Date): boolean {
  return windowAgeSec(windowStart, now) >= windowSec;
}

/** Seconds until the active window ends, floored at 1 for Retry-After semantics. */
export function retryAfterDelaySec(windowStart: Date, windowSec: number, now: Date): number {
  return Math.max(1, Math.ceil(windowSec - windowAgeSec(windowStart, now)));
}

export interface QuotaSnapshot {
  used: number;
  limit: number;
  remaining: number;
  windowEndsIn: number;
  pct: number;
}

/** Quota view of a bucket row; an expired window reads as untouched. */
export function quotaFromBucket(
  bucket: { count: number; windowStart: Date; limit: number; windowSec: number },
  now: Date
): QuotaSnapshot {
  if (isWindowExpired(bucket.windowStart, bucket.windowSec, now)) {
    return { used: 0, limit: bucket.limit, remaining: bucket.limit, windowEndsIn: 0, pct: 0 };
  }
  const used = bucket.count;
  return {
    used,
    limit: bucket.limit,
    remaining: Math.max(0, bucket.limit - used),
    windowEndsIn: Math.ceil(bucket.windowSec - windowAgeSec(bucket.windowStart, now)),
    pct: Math.round((used / bucket.limit) * 100),
  };
}
