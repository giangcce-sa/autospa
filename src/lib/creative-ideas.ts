import "server-only";

import { getConnectedChannels } from "@/lib/connected-channels";
import { foldBenchmarks, platformHistory } from "@/lib/content-benchmark";
import { prisma } from "@/lib/db";
import { scoreIdea, type IdeaScore } from "@/lib/idea-score";
import { countMatchingSources, findMatchingTopic } from "@/lib/topic-match";
import { getBusinessDayRange, nextAnnualBusinessOccurrence } from "@/lib/today-policy";

/**
 * Read model for the "Ý tưởng & Nghiên cứu" workspace.
 *
 * Reads stored rows only — it never triggers the external Google Trends / Ads
 * Library syncs or a Claude call (those belong to cron/daily-report). Every
 * number here traces to a persisted column; nothing is estimated.
 *
 * The opportunity score attached to each trend is a weighted sum of measured
 * inputs with a per-factor breakdown (see idea-score.ts) — it is auditable, and
 * factors with nothing to measure are marked rather than counted as zero. There
 * is still no pre-publish reach forecast: what the app can honestly show instead
 * is what similar published posts actually achieved (see content-benchmark.ts).
 */

const SIGNAL_LOOKBACK_DAYS = 60;
const SIGNAL_SCAN_LIMIT = 400;

export interface TrendSignal {
  key: string;
  source: string;
  topic: string;
  volume: number;
  trend: string;
  fetchedAt: string;
  /** Measured change vs the previous stored sample of the same source+topic. */
  deltaPct: number | null;
  comparedAt: string | null;
  /** Explainable opportunity score with its per-factor breakdown. */
  score: IdeaScore;
  /** Distinct research sources reporting this topic — feeds the score. */
  sourceCount: number;
  /** Matched competitor topic, or null when the competitor set does not cover it. */
  competitorMatch: { label: string; count: number } | null;
  /** Matched holiday, or null when the topic does not name one. */
  holidayMatch: { name: string; daysUntil: number } | null;
}

export interface CompetitorTopic {
  label: string;
  count: number;
}

export interface HolidayIdea {
  id: string;
  name: string;
  description: string | null;
  date: string;
  daysUntil: number;
  eventDate: string;
}

export interface ScheduleRow {
  id: string;
  caption: string;
  platform: string;
  status: string;
  scheduledAt: string;
}

export interface BrandSnapshot {
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  fontStyle: string;
  spaName: string | null;
  tagline: string | null;
}

function parseCountItems(raw: string): CompetitorTopic[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is { label: string; count?: number } =>
        !!item && typeof item === "object" && typeof (item as { label?: unknown }).label === "string")
      .map((item) => ({ label: item.label, count: Number(item.count ?? 0) }));
  } catch {
    return [];
  }
}

/**
 * Latest sample per source+topic, with the delta against the previous sample.
 * IntelligenceSignal is append-only, so a real percentage change is derivable —
 * the syncs currently compute a ratio and discard it, keeping only a
 * rising/stable/falling label.
 */
type FoldedSignal = Omit<TrendSignal, "score" | "sourceCount" | "competitorMatch" | "holidayMatch">;

function foldSignals(rows: Array<{ source: string; topic: string; volume: number; trend: string; fetchedAt: Date }>): FoldedSignal[] {
  const seen = new Map<string, FoldedSignal>();
  for (const row of rows) {
    const key = `${row.source}|${row.topic}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, {
        key,
        source: row.source,
        topic: row.topic,
        volume: row.volume,
        trend: row.trend,
        fetchedAt: row.fetchedAt.toISOString(),
        deltaPct: null,
        comparedAt: null,
      });
      continue;
    }
    // Rows arrive newest-first, so the second hit for a key is the previous sample.
    if (existing.deltaPct === null && existing.comparedAt === null && row.volume > 0) {
      existing.deltaPct = Math.round(((existing.volume - row.volume) / row.volume) * 100);
      existing.comparedAt = row.fetchedAt.toISOString();
    }
  }
  return [...seen.values()];
}

export async function getCreativeIdeasData({
  facebookPageId,
  includeAccountSignals,
  now = new Date(),
}: {
  facebookPageId: string;
  includeAccountSignals: boolean;
  now?: Date;
}) {
  const { start: dayStart, end: dayEnd } = getBusinessDayRange(now);
  const signalsSince = new Date(now.getTime() - SIGNAL_LOOKBACK_DAYS * 86400000);

  const [
    signalRows,
    competitorMemory,
    holidayRows,
    scheduleRows,
    brand,
    assetGroups,
    memoryRows,
    connectedChannels,
  ] = await Promise.all([
    includeAccountSignals
      ? prisma.intelligenceSignal.findMany({
          where: { fetchedAt: { gte: signalsSince } },
          orderBy: { fetchedAt: "desc" },
          take: SIGNAL_SCAN_LIMIT,
          select: { source: true, topic: true, volume: true, trend: true, fetchedAt: true },
        })
      : Promise.resolve([]),
    includeAccountSignals
      ? prisma.competitorMemory.findFirst({
          orderBy: { updatedAt: "desc" },
          select: { topTopics: true, sampleCount: true, confidence: true, updatedAt: true },
        })
      : Promise.resolve(null),
    includeAccountSignals
      ? prisma.holidayEvent.findMany({ where: { isActive: true }, select: { id: true, name: true, description: true, date: true } })
      : Promise.resolve([]),
    prisma.post.findMany({
      where: {
        facebookPageId,
        scheduledAt: { gte: dayStart, lte: dayEnd },
        status: { in: ["draft", "scheduled", "published"] },
      },
      orderBy: { scheduledAt: "asc" },
      take: 12,
      select: { id: true, caption: true, platform: true, status: true, scheduledAt: true },
    }),
    prisma.brandKit.findUnique({
      where: { facebookPageId },
      select: { logoUrl: true, primaryColor: true, accentColor: true, fontStyle: true, spaName: true, tagline: true },
    }),
    prisma.imageGeneration.groupBy({
      by: ["preset"],
      where: { facebookPageId },
      _count: { _all: true },
      orderBy: { _count: { preset: "desc" } },
    }),
    // ContentMemory is account-wide (no facebookPageId column) — the benchmarks
    // it produces are labelled as such in the UI.
    prisma.contentMemory.findMany({
      select: { postType: true, platform: true, tone: true, avgEngagement: true, sampleCount: true },
    }),
    getConnectedChannels(facebookPageId),
  ]);

  const holidays: HolidayIdea[] = holidayRows
    .flatMap((holiday) => {
      try {
        const { eventDate, daysUntil } = nextAnnualBusinessOccurrence(holiday.date, now);
        return [{ ...holiday, daysUntil, eventDate: eventDate.toISOString() }];
      } catch {
        return [];
      }
    })
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 6);

  const competitorTopics = competitorMemory ? parseCountItems(competitorMemory.topTopics) : [];

  // Score each folded signal against the other stored evidence. The joins are
  // strict (topic-match.ts), so an unmatched competitor topic or holiday means
  // "no data" for that factor rather than a zero.
  const trends: TrendSignal[] = foldSignals(signalRows)
    .map((signal) => {
      const competitorMatch = findMatchingTopic(signal.topic, competitorTopics, (topic) => topic.label);
      const holidayMatch = findMatchingTopic(signal.topic, holidays, (holiday) => holiday.name);
      const sourceCount = countMatchingSources(signal.topic, signalRows);
      return {
        ...signal,
        sourceCount,
        competitorMatch,
        holidayMatch: holidayMatch ? { name: holidayMatch.name, daysUntil: holidayMatch.daysUntil } : null,
        score: scoreIdea({
          deltaPct: signal.deltaPct,
          fetchedAt: signal.fetchedAt,
          sourceCount,
          competitorCount: competitorMatch ? competitorMatch.count : null,
          holidayDaysUntil: holidayMatch ? holidayMatch.daysUntil : null,
          now,
        }),
      };
    })
    .sort((a, b) => {
      // Score first — it already weights measured movement above freshness and
      // never reads raw volume, which is not comparable across sources
      // (Google index vs active-ad count).
      if (b.score.score !== a.score.score) return b.score.score - a.score.score;
      return b.fetchedAt.localeCompare(a.fetchedAt);
    });

  const signalSources = [...signalRows.reduce((acc, row) => {
    const current = acc.get(row.source);
    if (!current || row.fetchedAt > current.lastFetchedAt) {
      acc.set(row.source, { count: (current?.count ?? 0) + 1, lastFetchedAt: row.fetchedAt });
    } else {
      acc.set(row.source, { count: current.count + 1, lastFetchedAt: current.lastFetchedAt });
    }
    return acc;
  }, new Map<string, { count: number; lastFetchedAt: Date }>())]
    .map(([source, value]) => ({ source, count: value.count, lastFetchedAt: value.lastFetchedAt.toISOString() }))
    .sort((a, b) => b.count - a.count);

  return {
    trends,
    competitorTopics: competitorTopics.slice(0, 8),
    competitorMeta: competitorMemory
      ? {
          sampleCount: competitorMemory.sampleCount,
          confidence: competitorMemory.confidence,
          updatedAt: competitorMemory.updatedAt.toISOString(),
        }
      : null,
    holidays,
    schedule: scheduleRows.map((row) => ({
      ...row,
      scheduledAt: row.scheduledAt!.toISOString(),
    })),
    brand: brand as BrandSnapshot | null,
    assetGroups: assetGroups.map((group) => ({ preset: group.preset, count: group._count._all })),
    signalSources,
    connectedChannels,
    /** Measured averages of already-published posts, by postType + platform. */
    benchmarks: foldBenchmarks(memoryRows),
    /** Per-platform measured engagement, for ranking channels. */
    channelHistory: platformHistory(memoryRows),
  };
}

export type CreativeIdeasData = Awaited<ReturnType<typeof getCreativeIdeasData>>;
