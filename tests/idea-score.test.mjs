import test from "node:test";
import assert from "node:assert/strict";

import {
  MAX_WITHOUT_MOMENTUM,
  SCORE_WEIGHTS,
  scoreBand,
  scoreIdea,
} from "../src/lib/idea-score.ts";

const NOW = new Date("2026-07-27T10:00:00Z");
const base = {
  deltaPct: null,
  fetchedAt: NOW.toISOString(),
  sourceCount: 1,
  competitorCount: null,
  holidayDaysUntil: null,
  now: NOW,
};

test("weights sum to 1 so the score is bounded at 100", () => {
  const total = Object.values(SCORE_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
  assert.ok(Math.abs(total - 1) < 1e-9, `weights sum to ${total}`);
});

test("a fully maxed-out signal scores 100", () => {
  const result = scoreIdea({
    deltaPct: 200,
    fetchedAt: NOW.toISOString(),
    sourceCount: 3,
    competitorCount: 20,
    holidayDaysUntil: 3,
    now: NOW,
  });
  assert.equal(result.score, 100);
  assert.equal(result.preliminary, false);
});

test("an unmeasurable topic can never look hot", () => {
  const result = scoreIdea({ ...base, deltaPct: null, sourceCount: 3, competitorCount: 20, holidayDaysUntil: 1 });
  assert.equal(result.preliminary, true);
  assert.ok(result.score <= MAX_WITHOUT_MOMENTUM, `${result.score} must be <= ${MAX_WITHOUT_MOMENTUM}`);
  assert.equal(MAX_WITHOUT_MOMENTUM, 60);
  assert.notEqual(scoreBand(result.score), "high");
});

test("momentum saturates at +150% and ignores negatives", () => {
  const at150 = scoreIdea({ ...base, deltaPct: 150 }).score;
  const at400 = scoreIdea({ ...base, deltaPct: 400 }).score;
  assert.equal(at150, at400, "beyond saturation adds nothing");
  const falling = scoreIdea({ ...base, deltaPct: -80 });
  const flat = scoreIdea({ ...base, deltaPct: 0 });
  assert.equal(falling.score, flat.score, "a falling topic scores like a flat one");
  assert.equal(falling.breakdown.find((entry) => entry.factor === "momentum").points, 0);
});

test("freshness decays from full to zero over two weeks", () => {
  const fresh = scoreIdea({ ...base, fetchedAt: new Date(NOW.getTime() - 2 * 3600_000).toISOString() });
  const midway = scoreIdea({ ...base, fetchedAt: new Date(NOW.getTime() - 7 * 24 * 3600_000).toISOString() });
  const stale = scoreIdea({ ...base, fetchedAt: new Date(NOW.getTime() - 30 * 24 * 3600_000).toISOString() });
  const points = (result) => result.breakdown.find((entry) => entry.factor === "freshness").points;
  assert.equal(points(fresh), 15);
  assert.ok(points(midway) > 0 && points(midway) < 15);
  assert.equal(points(stale), 0);
});

test("corroboration rewards multiple sources", () => {
  const points = (sourceCount) =>
    scoreIdea({ ...base, sourceCount }).breakdown.find((entry) => entry.factor === "corroboration").points;
  assert.equal(points(0), 0);
  assert.ok(points(1) < points(2));
  assert.ok(points(2) < points(3));
  assert.equal(points(3), points(9), "three sources is already maximal");
});

test("competitor demand and seasonality step as documented", () => {
  const competitor = (count) =>
    scoreIdea({ ...base, competitorCount: count }).breakdown.find((e) => e.factor === "competitorDemand").points;
  assert.equal(competitor(null), 0);
  assert.equal(competitor(0), 0);
  assert.ok(competitor(2) < competitor(6));
  assert.ok(competitor(6) < competitor(20));

  const season = (days) =>
    scoreIdea({ ...base, holidayDaysUntil: days }).breakdown.find((e) => e.factor === "seasonality").points;
  assert.equal(season(null), 0);
  assert.ok(season(3) > season(20));
  assert.ok(season(20) > season(90));
});

test("breakdown is auditable: points sum exactly to the score", () => {
  const result = scoreIdea({ ...base, deltaPct: 90, sourceCount: 2, competitorCount: 7, holidayDaysUntil: 10 });
  const summed = result.breakdown.reduce((sum, entry) => sum + entry.points, 0);
  assert.equal(summed, result.score);
  assert.equal(result.breakdown.length, Object.keys(SCORE_WEIGHTS).length);
  const maxTotal = result.breakdown.reduce((sum, entry) => sum + entry.maxPoints, 0);
  assert.equal(maxTotal, 100, "maxPoints is the per-factor ceiling shown to the user");
  for (const entry of result.breakdown) {
    assert.ok(entry.label.length > 0, "every factor has a Vietnamese label");
    assert.ok(entry.detail.length > 0, "every factor explains itself");
    assert.ok(entry.points <= entry.maxPoints);
    assert.ok(entry.factorValue >= 0 && entry.factorValue <= 1);
  }
});

test("a missing measurement is flagged, never shown as a measured zero", () => {
  const blind = scoreIdea({ ...base, deltaPct: null, competitorCount: null, holidayDaysUntil: null });
  const byFactor = Object.fromEntries(blind.breakdown.map((entry) => [entry.factor, entry]));
  assert.equal(byFactor.momentum.hasData, false);
  assert.equal(byFactor.competitorDemand.hasData, false);
  assert.equal(byFactor.seasonality.hasData, false);
  assert.equal(byFactor.freshness.hasData, true, "freshness is always measurable");
  assert.equal(byFactor.corroboration.hasData, true);

  // A measured zero is a different statement from no data.
  const measuredZero = scoreIdea({ ...base, deltaPct: 0, competitorCount: 0, holidayDaysUntil: 0 });
  const zeroByFactor = Object.fromEntries(measuredZero.breakdown.map((entry) => [entry.factor, entry]));
  assert.equal(zeroByFactor.momentum.hasData, true);
  assert.equal(zeroByFactor.momentum.points, 0);
  assert.equal(zeroByFactor.competitorDemand.hasData, true);
  assert.equal(zeroByFactor.competitorDemand.points, 0);
  assert.equal(zeroByFactor.seasonality.hasData, true);
  assert.ok(zeroByFactor.seasonality.points > 0, "a holiday today is maximal seasonality, not absent data");
});

test("factor details quote the measurement rather than describing it vaguely", () => {
  const rising = scoreIdea({ ...base, deltaPct: 42, sourceCount: 2, competitorCount: 7, holidayDaysUntil: 10 });
  const detail = (factor) => rising.breakdown.find((entry) => entry.factor === factor).detail;
  assert.match(detail("momentum"), /42%/);
  assert.match(detail("corroboration"), /2 nguồn/);
  assert.match(detail("competitorDemand"), /7 bài/);
  assert.match(detail("seasonality"), /10 ngày/);

  const falling = scoreIdea({ ...base, deltaPct: -30 });
  assert.match(falling.breakdown.find((entry) => entry.factor === "momentum").detail, /Giảm 30%/);
});

test("a malformed timestamp degrades to zero freshness instead of NaN", () => {
  const result = scoreIdea({ ...base, fetchedAt: "not a date", deltaPct: 150 });
  assert.ok(Number.isFinite(result.score));
  assert.equal(result.breakdown.find((entry) => entry.factor === "freshness").points, 0);
});

test("scoreBand thresholds", () => {
  assert.equal(scoreBand(100), "high");
  assert.equal(scoreBand(65), "high");
  assert.equal(scoreBand(64), "medium");
  assert.equal(scoreBand(40), "medium");
  assert.equal(scoreBand(39), "low");
  assert.equal(scoreBand(0), "low");
});
