/**
 * Channel suggestion for a piece of content.
 *
 * Honest by construction:
 * - Only channels that are actually CONNECTED can be recommended.
 * - Ranking prefers MEASURED per-platform engagement (ContentMemory) and only
 *   when there are at least `MIN_HISTORY_SAMPLES` posts behind it; otherwise it
 *   falls back to caption-length fit, and the channel is reported as
 *   "not enough data" rather than being given a fabricated score.
 * - No predicted reach/engagement numbers are produced anywhere.
 *
 * Pure module (no prisma, no server-only) so it is unit-testable.
 */

/**
 * Mirrors PLATFORM_LENGTH_RANGES in src/lib/reviewer.ts. A drift guard in
 * tests/channel-fit.test.mjs compares the two, so the reviewer stays the single
 * source of truth for what "too short/too long" means.
 */
export const PLATFORM_LENGTH_RANGES: Record<string, { min: number; max: number; ideal: [number, number] }> = {
  facebook: { min: 50, max: 600, ideal: [100, 300] },
  zalo: { min: 30, max: 300, ideal: [50, 150] },
  tiktok: { min: 20, max: 200, ideal: [30, 100] },
  instagram: { min: 50, max: 400, ideal: [80, 200] },
};

export const MIN_HISTORY_SAMPLES = 5;

/**
 * Which channels this account can actually publish to right now, derived from
 * stored credentials only. A channel with no credential is never returned, so
 * the UI cannot suggest a channel the user has not connected.
 */
export function resolveConnectedChannels(input: {
  /** The selected FacebookPage always carries an accessToken, so facebook is on when a page is selected. */
  hasFacebookPage: boolean;
  /** Instagram Business account linked to that page. */
  hasInstagramAccount?: boolean;
  /** Callers pass presence only — the token itself is encrypted and stays server-side. */
  hasZaloToken?: boolean;
  hasZaloOaId?: boolean;
  /** Number of TikTokAccount rows with isActive = true. */
  activeTiktokAccounts?: number;
}): string[] {
  const channels: string[] = [];
  if (input.hasFacebookPage) channels.push("facebook");
  if (input.hasInstagramAccount) channels.push("instagram");
  if (input.hasZaloToken && input.hasZaloOaId) channels.push("zalo");
  if ((input.activeTiktokAccounts ?? 0) > 0) channels.push("tiktok");
  return channels;
}

export type LengthFit = "ideal" | "ok" | "too_short" | "too_long";

export const LENGTH_FIT_LABELS: Record<LengthFit, string> = {
  ideal: "Độ dài phù hợp",
  ok: "Độ dài chấp nhận được",
  too_short: "Bài hơi ngắn cho kênh này",
  too_long: "Bài hơi dài cho kênh này",
};

/**
 * Words in a caption, using the same rule as reviewer.ts checkLength
 * (whitespace-split), so the two never disagree about what "50 từ" means.
 * Empty text is 0 words here — the reviewer's raw split would say 1, but both
 * land on "too short" for every platform, so no verdict changes.
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export function lengthFitFor(platform: string, wordCount: number): LengthFit {
  const range = PLATFORM_LENGTH_RANGES[platform] ?? PLATFORM_LENGTH_RANGES.facebook;
  if (wordCount < range.min) return "too_short";
  if (wordCount > range.max) return "too_long";
  if (wordCount >= range.ideal[0] && wordCount <= range.ideal[1]) return "ideal";
  return "ok";
}

const FIT_RANK: Record<LengthFit, number> = { ideal: 3, ok: 2, too_short: 1, too_long: 0 };

export interface ChannelHistory {
  platform: string;
  avgEngagement: number;
  sampleCount: number;
}

export interface ChannelSuggestion {
  channel: string;
  /** Rank among connected channels, 1-based. */
  rank: number;
  lengthFit: LengthFit;
  /** Measured average engagement, only when backed by enough samples. */
  measuredEngagement: number | null;
  sampleCount: number;
  /** True when the author explicitly targeted this channel. */
  targeted: boolean;
  /** Short Vietnamese reasons, in priority order. */
  reasons: string[];
}

export function suggestChannels({
  connected,
  wordCount,
  history = [],
  targetChannels = [],
}: {
  connected: string[];
  wordCount: number;
  history?: ChannelHistory[];
  targetChannels?: string[];
}): ChannelSuggestion[] {
  const historyByPlatform = new Map(history.map((row) => [row.platform, row]));

  const rows = connected.map((channel) => {
    const stored = historyByPlatform.get(channel);
    const hasEnough = !!stored && stored.sampleCount >= MIN_HISTORY_SAMPLES;
    const lengthFit = lengthFitFor(channel, wordCount);
    const targeted = targetChannels.includes(channel);

    const reasons: string[] = [];
    if (hasEnough && stored) {
      reasons.push(`Tương tác trung bình đã đo ${stored.avgEngagement.toFixed(1)} trên ${stored.sampleCount} bài`);
    } else if (stored) {
      reasons.push(`Chỉ có ${stored.sampleCount} bài — chưa đủ ${MIN_HISTORY_SAMPLES} bài để so sánh`);
    } else {
      reasons.push("Chưa có dữ liệu hiệu quả cho kênh này");
    }
    reasons.push(LENGTH_FIT_LABELS[lengthFit]);
    if (targeted) reasons.push("Bạn đã chọn kênh này");

    return {
      channel,
      rank: 0,
      lengthFit,
      measuredEngagement: hasEnough && stored ? stored.avgEngagement : null,
      sampleCount: stored?.sampleCount ?? 0,
      targeted,
      reasons,
    };
  });

  rows.sort((a, b) => {
    // Measured history outranks everything, but only where it exists.
    if (a.measuredEngagement !== null && b.measuredEngagement !== null) {
      if (b.measuredEngagement !== a.measuredEngagement) return b.measuredEngagement - a.measuredEngagement;
    } else if (a.measuredEngagement !== null) return -1;
    else if (b.measuredEngagement !== null) return 1;

    if (FIT_RANK[b.lengthFit] !== FIT_RANK[a.lengthFit]) return FIT_RANK[b.lengthFit] - FIT_RANK[a.lengthFit];
    if (a.targeted !== b.targeted) return a.targeted ? -1 : 1;
    return a.channel.localeCompare(b.channel);
  });

  return rows.map((row, index) => ({ ...row, rank: index + 1 }));
}
