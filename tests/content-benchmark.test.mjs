import test from "node:test";
import assert from "node:assert/strict";

import {
  MIN_BENCHMARK_SAMPLES,
  benchmarkFor,
  foldBenchmarks,
  platformHistory,
} from "../src/lib/content-benchmark.ts";

const row = (over = {}) => ({
  postType: "promotion",
  platform: "facebook",
  tone: "friendly",
  avgEngagement: 10,
  sampleCount: 10,
  ...over,
});

test("a group below the sample floor is withheld entirely", () => {
  const folded = foldBenchmarks([row({ sampleCount: MIN_BENCHMARK_SAMPLES - 1 })]);
  assert.deepEqual(folded, [], "not enough published posts means no benchmark at all");
});

test("the average is sample-weighted, not a mean of means", () => {
  const folded = foldBenchmarks([
    row({ tone: "friendly", avgEngagement: 10, sampleCount: 90 }),
    row({ tone: "urgent", avgEngagement: 20, sampleCount: 10 }),
  ]);
  assert.equal(folded.length, 1);
  // (10*90 + 20*10) / 100 = 11, not (10+20)/2 = 15
  assert.equal(folded[0].avgEngagement, 11);
  assert.equal(folded[0].sampleCount, 100);
});

test("rows with no postType or no samples are dropped", () => {
  const folded = foldBenchmarks([
    row({ postType: null, sampleCount: 50 }),
    row({ sampleCount: 0 }),
    row({ avgEngagement: Number.NaN, sampleCount: 50 }),
  ]);
  assert.deepEqual(folded, []);
});

test("postType and platform are separate groups", () => {
  const folded = foldBenchmarks([
    row({ postType: "promotion", platform: "facebook", sampleCount: 20, avgEngagement: 5 }),
    row({ postType: "promotion", platform: "zalo", sampleCount: 8, avgEngagement: 30 }),
    row({ postType: "education", platform: "facebook", sampleCount: 6, avgEngagement: 12 }),
  ]);
  assert.equal(folded.length, 3);
  assert.deepEqual(
    folded.map((entry) => entry.sampleCount),
    [20, 8, 6],
    "sorted by sample count, most-evidenced first",
  );
  const zalo = folded.find((entry) => entry.platform === "zalo");
  assert.equal(zalo.avgEngagement, 30, "the zalo average must not be blended with facebook");
});

test("bestTone appears only when that tone alone clears the floor", () => {
  const thin = foldBenchmarks([
    row({ tone: "friendly", sampleCount: 4, avgEngagement: 5 }),
    row({ tone: "urgent", sampleCount: 4, avgEngagement: 50 }),
  ]);
  assert.equal(thin.length, 1, "8 samples total clears the group floor");
  assert.equal(thin[0].bestTone, null, "but neither tone has 5 on its own");

  const solid = foldBenchmarks([
    row({ tone: "friendly", sampleCount: 20, avgEngagement: 5 }),
    row({ tone: "urgent", sampleCount: 10, avgEngagement: 50 }),
  ]);
  assert.deepEqual(solid[0].bestTone, { tone: "urgent", avgEngagement: 50, sampleCount: 10 });
});

test("benchmarkFor never widens the match to manufacture a hit", () => {
  const folded = foldBenchmarks([row({ postType: "promotion", platform: "facebook" })]);
  assert.equal(benchmarkFor(folded, "promotion", "facebook").sampleCount, 10);
  assert.equal(benchmarkFor(folded, "promotion", "zalo"), null);
  assert.equal(benchmarkFor(folded, "education", "facebook"), null);
  assert.equal(benchmarkFor(folded, null, "facebook"), null);
  assert.equal(benchmarkFor(folded, "promotion", null), null);
  assert.equal(benchmarkFor([], "promotion", "facebook"), null);
});

test("platformHistory collapses postTypes but keeps platforms apart", () => {
  const history = platformHistory([
    row({ postType: "promotion", platform: "facebook", avgEngagement: 10, sampleCount: 30 }),
    row({ postType: "education", platform: "facebook", avgEngagement: 20, sampleCount: 10 }),
    row({ postType: null, platform: "zalo", avgEngagement: 7, sampleCount: 5 }),
  ]);
  const facebook = history.find((entry) => entry.platform === "facebook");
  assert.equal(facebook.sampleCount, 40);
  assert.equal(facebook.avgEngagement, 12.5); // (10*30 + 20*10) / 40
  const zalo = history.find((entry) => entry.platform === "zalo");
  assert.equal(zalo.sampleCount, 5, "a null postType still counts toward per-platform history");
  // platformHistory reports what exists; the sample floor is applied by channel-fit.
  assert.equal(history.length, 2);
});
