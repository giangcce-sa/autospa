/**
 * "Hiệu quả tương tự đã đo" — benchmarks from posts we have actually published.
 *
 * This replaces the old fabricated "Hiệu quả dự kiến". It is a plain
 * sample-weighted average of ContentMemory.avgEngagement grouped by
 * postType + platform, always shown with its sample count, and withheld
 * entirely below MIN_BENCHMARK_SAMPLES. It is a description of the past, not a
 * forecast — nothing here predicts how a specific draft will perform.
 *
 * Pure module (no prisma, no server-only) so it is unit-testable.
 */

/** Below this many published posts an average is noise, so we say "chưa đủ dữ liệu". */
export const MIN_BENCHMARK_SAMPLES = 5;

export interface ContentMemoryRow {
  postType: string | null;
  platform: string;
  tone: string | null;
  avgEngagement: number;
  sampleCount: number;
}

export interface ContentBenchmark {
  postType: string;
  platform: string;
  /** Sample-weighted mean of the underlying rows. */
  avgEngagement: number;
  /** Total posts behind the average. */
  sampleCount: number;
  /** Best-performing tone within this group, when that tone alone clears the floor. */
  bestTone: { tone: string; avgEngagement: number; sampleCount: number } | null;
}

function weightedMean(rows: Array<{ avgEngagement: number; sampleCount: number }>) {
  const samples = rows.reduce((sum, row) => sum + row.sampleCount, 0);
  if (samples <= 0) return { avgEngagement: 0, sampleCount: 0 };
  const total = rows.reduce((sum, row) => sum + row.avgEngagement * row.sampleCount, 0);
  return { avgEngagement: Number((total / samples).toFixed(2)), sampleCount: samples };
}

/**
 * Groups memory rows by postType + platform. Rows with no postType, or with no
 * samples behind them, are dropped — they cannot answer "similar to what?".
 */
export function foldBenchmarks(rows: ContentMemoryRow[]): ContentBenchmark[] {
  const groups = new Map<string, ContentMemoryRow[]>();
  for (const row of rows) {
    if (!row.postType || row.sampleCount <= 0 || !Number.isFinite(row.avgEngagement)) continue;
    const key = `${row.postType}|${row.platform}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(row);
    else groups.set(key, [row]);
  }

  const benchmarks: ContentBenchmark[] = [];
  for (const [key, bucket] of groups) {
    const { avgEngagement, sampleCount } = weightedMean(bucket);
    if (sampleCount < MIN_BENCHMARK_SAMPLES) continue;
    const [postType, platform] = key.split("|");

    const tones = new Map<string, Array<{ avgEngagement: number; sampleCount: number }>>();
    for (const row of bucket) {
      if (!row.tone) continue;
      const list = tones.get(row.tone);
      if (list) list.push(row);
      else tones.set(row.tone, [row]);
    }
    let bestTone: ContentBenchmark["bestTone"] = null;
    for (const [tone, list] of tones) {
      const folded = weightedMean(list);
      if (folded.sampleCount < MIN_BENCHMARK_SAMPLES) continue;
      if (!bestTone || folded.avgEngagement > bestTone.avgEngagement) {
        bestTone = { tone, avgEngagement: folded.avgEngagement, sampleCount: folded.sampleCount };
      }
    }

    benchmarks.push({ postType, platform, avgEngagement, sampleCount, bestTone });
  }

  return benchmarks.sort((a, b) => b.sampleCount - a.sampleCount || a.postType.localeCompare(b.postType));
}

/** Exact postType+platform match, or null. Never widens the query to fake a hit. */
export function benchmarkFor(
  benchmarks: ContentBenchmark[],
  postType: string | null | undefined,
  platform: string | null | undefined,
): ContentBenchmark | null {
  if (!postType || !platform) return null;
  return benchmarks.find((row) => row.postType === postType && row.platform === platform) ?? null;
}

/**
 * Per-platform history for channel ranking: collapses every postType into one
 * measured average per platform.
 */
export function platformHistory(rows: ContentMemoryRow[]): Array<{ platform: string; avgEngagement: number; sampleCount: number }> {
  const groups = new Map<string, ContentMemoryRow[]>();
  for (const row of rows) {
    if (row.sampleCount <= 0 || !Number.isFinite(row.avgEngagement)) continue;
    const bucket = groups.get(row.platform);
    if (bucket) bucket.push(row);
    else groups.set(row.platform, [row]);
  }
  return [...groups].map(([platform, bucket]) => ({ platform, ...weightedMean(bucket) }));
}
