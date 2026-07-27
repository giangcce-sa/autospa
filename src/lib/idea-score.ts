/**
 * Opportunity score for a research signal — an explainable weighted sum of
 * MEASURED inputs, never a model guess.
 *
 * Deliberate design choices:
 * - `IntelligenceSignal.volume` is NOT an input. Google Trends volume (~10,000s)
 *   and Ads-Library active-ad counts (~10s) are different units; ranking them
 *   together would just sort by source.
 * - A topic whose momentum cannot be measured (no previous stored sample) can
 *   never score above `MAX_WITHOUT_MOMENTUM`, and is flagged `preliminary`, so an
 *   unmeasured topic can never present as a hot one.
 * - Every factor reports `hasData`, so the UI can say "chưa có dữ liệu" instead
 *   of showing a zero that looks like a measurement. Most topics legitimately
 *   have no corroboration or seasonal evidence — the score says so out loud
 *   rather than padding the number.
 *
 * Pure module (no prisma, no server-only) so it is unit-testable.
 */

export interface IdeaScoreInput {
  /** Measured change vs the previous stored sample of the same source+topic. */
  deltaPct: number | null;
  /** When the latest sample was collected. */
  fetchedAt: string;
  /** Distinct research sources reporting this topic (1..n). */
  sourceCount: number;
  /** Competitor posts on this topic, from CompetitorMemory. Null = no match. */
  competitorCount: number | null;
  /** Days until a holiday this topic actually names. Null = no seasonal tie. */
  holidayDaysUntil: number | null;
  /** Evaluation time; injected so the result is deterministic in tests. */
  now?: Date;
}

export const SCORE_WEIGHTS = {
  momentum: 0.4,
  freshness: 0.15,
  corroboration: 0.2,
  competitorDemand: 0.15,
  seasonality: 0.1,
} as const;

export type ScoreFactor = keyof typeof SCORE_WEIGHTS;

/** Highest score reachable when momentum is unmeasurable (momentum contributes 0). */
export const MAX_WITHOUT_MOMENTUM = Math.round((1 - SCORE_WEIGHTS.momentum) * 100);

/** Momentum saturates here: +150% or more is already a maximal signal. */
const MOMENTUM_SATURATION_PCT = 150;
const FRESHNESS_FULL_HOURS = 24;
const FRESHNESS_ZERO_HOURS = 14 * 24;

export const FACTOR_LABELS: Record<ScoreFactor, string> = {
  momentum: "Đà tăng đã đo",
  freshness: "Độ mới của dữ liệu",
  corroboration: "Số nguồn xác nhận",
  competitorDemand: "Đối thủ đang làm",
  seasonality: "Tính thời điểm",
};

export interface FactorResult {
  factor: ScoreFactor;
  label: string;
  /** 0..1 contribution ratio. */
  factorValue: number;
  points: number;
  maxPoints: number;
  /** False when the app has nothing to measure — not the same as a measured zero. */
  hasData: boolean;
  /** Vietnamese one-liner naming the evidence (or its absence). */
  detail: string;
}

export interface IdeaScore {
  /** 0-100. */
  score: number;
  /** True when momentum could not be measured, so the score is capped. */
  preliminary: boolean;
  breakdown: FactorResult[];
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function describeAge(hours: number) {
  if (hours < 1) return "vừa đồng bộ";
  if (hours < 24) return `đồng bộ ${Math.round(hours)} giờ trước`;
  return `đồng bộ ${Math.round(hours / 24)} ngày trước`;
}

function momentumOf(deltaPct: number | null) {
  if (deltaPct === null) {
    return { value: 0, hasData: false, detail: "Chưa có mẫu trước để so sánh" };
  }
  if (deltaPct <= 0) {
    return {
      value: 0,
      hasData: true,
      detail: deltaPct === 0 ? "Không đổi so với lần đo trước" : `Giảm ${Math.abs(deltaPct)}% so với lần đo trước`,
    };
  }
  return { value: clamp01(deltaPct / MOMENTUM_SATURATION_PCT), hasData: true, detail: `Tăng ${deltaPct}% so với lần đo trước` };
}

function freshnessOf(fetchedAt: string, now: Date) {
  const hours = (now.getTime() - new Date(fetchedAt).getTime()) / 3_600_000;
  if (!Number.isFinite(hours)) return { value: 0, hasData: false, detail: "Không đọc được thời điểm đồng bộ" };
  if (hours <= FRESHNESS_FULL_HOURS) return { value: 1, hasData: true, detail: describeAge(Math.max(hours, 0)) };
  if (hours >= FRESHNESS_ZERO_HOURS) return { value: 0, hasData: true, detail: `Dữ liệu cũ, ${describeAge(hours)}` };
  const value = clamp01(1 - (hours - FRESHNESS_FULL_HOURS) / (FRESHNESS_ZERO_HOURS - FRESHNESS_FULL_HOURS));
  return { value, hasData: true, detail: describeAge(hours) };
}

function corroborationOf(sourceCount: number) {
  if (sourceCount <= 0) return { value: 0, hasData: false, detail: "Không rõ nguồn" };
  const value = sourceCount >= 3 ? 1 : sourceCount === 2 ? 0.8 : 0.4;
  return {
    value,
    hasData: true,
    detail: sourceCount === 1 ? "Chỉ 1 nguồn báo chủ đề này" : `${sourceCount} nguồn cùng báo chủ đề này`,
  };
}

function competitorOf(competitorCount: number | null) {
  if (competitorCount === null) return { value: 0, hasData: false, detail: "Chưa phân tích đối thủ cho chủ đề này" };
  if (competitorCount <= 0) return { value: 0, hasData: true, detail: "Đối thủ chưa đăng về chủ đề này" };
  const value = competitorCount >= 15 ? 1 : competitorCount >= 5 ? 0.8 : 0.5;
  return { value, hasData: true, detail: `${competitorCount} bài của đối thủ về chủ đề này` };
}

function seasonalityOf(holidayDaysUntil: number | null) {
  if (holidayDaysUntil === null || holidayDaysUntil < 0) {
    return { value: 0, hasData: false, detail: "Không gắn với dịp lễ nào" };
  }
  const value = holidayDaysUntil <= 14 ? 1 : holidayDaysUntil <= 30 ? 0.6 : 0.2;
  const when = holidayDaysUntil === 0 ? "diễn ra hôm nay" : `còn ${holidayDaysUntil} ngày`;
  return { value, hasData: true, detail: `Gắn với dịp lễ ${when}` };
}

export function scoreIdea(input: IdeaScoreInput): IdeaScore {
  const now = input.now ?? new Date();
  const measured: Record<ScoreFactor, { value: number; hasData: boolean; detail: string }> = {
    momentum: momentumOf(input.deltaPct),
    freshness: freshnessOf(input.fetchedAt, now),
    corroboration: corroborationOf(input.sourceCount),
    competitorDemand: competitorOf(input.competitorCount),
    seasonality: seasonalityOf(input.holidayDaysUntil),
  };

  const breakdown: FactorResult[] = (Object.keys(SCORE_WEIGHTS) as ScoreFactor[]).map((factor) => {
    const entry = measured[factor];
    return {
      factor,
      label: FACTOR_LABELS[factor],
      factorValue: Number(entry.value.toFixed(2)),
      points: Math.round(entry.value * SCORE_WEIGHTS[factor] * 100),
      maxPoints: Math.round(SCORE_WEIGHTS[factor] * 100),
      hasData: entry.hasData,
      detail: entry.detail,
    };
  });

  return {
    score: breakdown.reduce((sum, entry) => sum + entry.points, 0),
    preliminary: input.deltaPct === null,
    breakdown,
  };
}

/** Coarse band for colouring, so the UI never invents its own thresholds. */
export function scoreBand(score: number): "high" | "medium" | "low" {
  if (score >= 65) return "high";
  if (score >= 40) return "medium";
  return "low";
}
