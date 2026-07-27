import test from "node:test";
import assert from "node:assert/strict";

import { RUN_GAP_MS, foldSyncRuns, mergeTimeline } from "../src/lib/research-history.ts";

const at = (isoMinutes) => `2026-07-27T${isoMinutes}:00.000Z`;

test("rows written seconds apart from one source form a single run", () => {
  const runs = foldSyncRuns([
    { source: "google_trends", topic: "peel da", fetchedAt: "2026-07-27T09:00:00.000Z" },
    { source: "google_trends", topic: "trẻ hóa da", fetchedAt: "2026-07-27T09:00:03.000Z" },
    { source: "google_trends", topic: "trị nám", fetchedAt: "2026-07-27T09:00:07.000Z" },
  ]);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].topicCount, 3);
  assert.equal(runs[0].startedAt, "2026-07-27T09:00:00.000Z");
  assert.equal(runs[0].endedAt, "2026-07-27T09:00:07.000Z");
  assert.deepEqual(runs[0].sampleTopics, ["peel da", "trẻ hóa da", "trị nám"]);
});

test("a gap larger than the window splits runs", () => {
  const runs = foldSyncRuns([
    { source: "google_trends", topic: "a", fetchedAt: at("09:00") },
    { source: "google_trends", topic: "b", fetchedAt: at("09:01") },
    { source: "google_trends", topic: "c", fetchedAt: at("14:00") },
  ]);
  assert.equal(runs.length, 2);
  assert.equal(runs[0].startedAt, at("14:00"), "newest run first");
  assert.equal(runs[1].topicCount, 2);
});

test("sources never merge into the same run", () => {
  const runs = foldSyncRuns([
    { source: "google_trends", topic: "a", fetchedAt: at("09:00") },
    { source: "fb_ads_library", topic: "b", fetchedAt: at("09:00") },
  ]);
  assert.equal(runs.length, 2);
  assert.deepEqual(new Set(runs.map((run) => run.source)), new Set(["google_trends", "fb_ads_library"]));
});

test("duplicate topics inside one run are counted once", () => {
  const runs = foldSyncRuns([
    { source: "google_trends", topic: "peel da", fetchedAt: at("09:00") },
    { source: "google_trends", topic: "peel da", fetchedAt: at("09:00") },
  ]);
  assert.equal(runs[0].topicCount, 1);
  assert.deepEqual(runs[0].sampleTopics, ["peel da"]);
});

test("the grouping under-counts runs rather than inventing them", () => {
  // Two real syncs 30s apart are indistinguishable from one; they merge.
  const runs = foldSyncRuns([
    { source: "google_trends", topic: "a", fetchedAt: "2026-07-27T09:00:00.000Z" },
    { source: "google_trends", topic: "b", fetchedAt: "2026-07-27T09:00:30.000Z" },
  ]);
  assert.equal(runs.length, 1, "merging is the documented, safe direction");
  assert.ok(RUN_GAP_MS === 120_000);
});

test("an unparseable timestamp is dropped, not placed arbitrarily", () => {
  const runs = foldSyncRuns([
    { source: "google_trends", topic: "good", fetchedAt: at("09:00") },
    { source: "google_trends", topic: "bad", fetchedAt: "khong-phai-ngay" },
  ]);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].topicCount, 1);
  assert.deepEqual(runs[0].sampleTopics, ["good"]);
});

test("empty input yields no runs", () => {
  assert.deepEqual(foldSyncRuns([]), []);
});

test("mergeTimeline orders newest first, drops bad timestamps, and honours the limit", () => {
  const merged = mergeTimeline(
    [
      [{ key: "a", kind: "sync", at: at("09:00"), title: "A", detail: "" }],
      [
        { key: "b", kind: "draft", at: at("11:00"), title: "B", detail: "" },
        { key: "bad", kind: "job", at: "nope", title: "Bad", detail: "" },
      ],
      [{ key: "c", kind: "generation", at: at("10:00"), title: "C", detail: "" }],
    ],
    2,
  );
  assert.deepEqual(merged.map((entry) => entry.key), ["b", "c"]);
});
