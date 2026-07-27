import test from "node:test";
import assert from "node:assert/strict";

import {
  isWindowExpired,
  quotaFromBucket,
  retryAfterDelaySec,
  windowAgeSec,
} from "../src/lib/rate-limit-policy.ts";

const at = (iso) => new Date(iso);

test("windowAgeSec measures elapsed seconds", () => {
  assert.equal(windowAgeSec(at("2026-07-26T10:00:00Z"), at("2026-07-26T10:00:30Z")), 30);
  assert.equal(windowAgeSec(at("2026-07-26T10:00:00Z"), at("2026-07-26T10:00:00Z")), 0);
});

test("isWindowExpired flips exactly at windowSec", () => {
  const start = at("2026-07-26T10:00:00Z");
  assert.equal(isWindowExpired(start, 60, at("2026-07-26T10:00:59Z")), false);
  assert.equal(isWindowExpired(start, 60, at("2026-07-26T10:01:00Z")), true);
  assert.equal(isWindowExpired(start, 60, at("2026-07-26T10:05:00Z")), true);
});

test("retryAfterDelaySec counts down to window end and floors at 1", () => {
  const start = at("2026-07-26T10:00:00Z");
  assert.equal(retryAfterDelaySec(start, 60, at("2026-07-26T10:00:00Z")), 60);
  assert.equal(retryAfterDelaySec(start, 60, at("2026-07-26T10:00:45Z")), 15);
  assert.equal(retryAfterDelaySec(start, 60, at("2026-07-26T10:00:59.500Z")), 1);
  assert.equal(retryAfterDelaySec(start, 60, at("2026-07-26T10:01:30Z")), 1);
});

test("quotaFromBucket reports an active window", () => {
  const quota = quotaFromBucket(
    { count: 3, windowStart: at("2026-07-26T10:00:00Z"), limit: 10, windowSec: 60 },
    at("2026-07-26T10:00:30Z")
  );
  assert.deepEqual(quota, { used: 3, limit: 10, remaining: 7, windowEndsIn: 30, pct: 30 });
});

test("quotaFromBucket treats an expired window as untouched", () => {
  const quota = quotaFromBucket(
    { count: 10, windowStart: at("2026-07-26T10:00:00Z"), limit: 10, windowSec: 60 },
    at("2026-07-26T10:02:00Z")
  );
  assert.deepEqual(quota, { used: 0, limit: 10, remaining: 10, windowEndsIn: 0, pct: 0 });
});

test("quotaFromBucket clamps remaining at 0 when count overshoots limit", () => {
  const quota = quotaFromBucket(
    { count: 14, windowStart: at("2026-07-26T10:00:00Z"), limit: 10, windowSec: 60 },
    at("2026-07-26T10:00:30Z")
  );
  assert.equal(quota.remaining, 0);
  assert.equal(quota.used, 14);
  assert.equal(quota.pct, 140);
});

test("rate-limiter uses a single atomic statement", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../src/lib/rate-limiter.ts", import.meta.url), "utf8");
  assert.match(source, /ON CONFLICT \("id"\) DO UPDATE/);
  assert.match(source, /"updatedAt" = \$\{now\}/);
  assert.doesNotMatch(source, /findUnique\(\{ where: \{ id: key \} \}\);\s*\n\s*let count/);
  assert.match(source, /export async function resetBucket/);
});
