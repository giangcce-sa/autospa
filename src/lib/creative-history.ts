import "server-only";

import { POST_TYPE_LABELS, SIGNAL_SOURCE_LABELS, label } from "@/lib/creative-labels";
import { prisma } from "@/lib/db";
import {
  foldSyncRuns,
  mergeTimeline,
  type HistoryEntry,
  type SyncRun,
} from "@/lib/research-history";

/**
 * Read model for the "Lịch sử" tab of the ideas workspace.
 *
 * This view used to say the domain had nothing to show. It does: four stored
 * sources of provenance, all real rows —
 *   - IntelligenceSignal (append-only) → reconstructed sync runs
 *   - ContentGeneration                → which model produced a draft, its score
 *   - Post (AI-RESEARCH convention)    → drafts created from research
 *   - JobRun                           → the cron runs that drive the syncs
 *
 * What is still genuinely absent is per-signal provenance: the app never stored
 * which signal a draft came from, so this timeline never claims a causal link
 * between a sync and a draft. It reports what happened and when.
 */

const LOOKBACK_DAYS = 60;
const SIGNAL_SCAN_LIMIT = 800;
const TIMELINE_LIMIT = 60;

/** Cron jobs whose runs belong to the content pipeline. */
const CONTENT_JOB_NAMES = ["daily_report", "auto_publish", "realtime_monitor"] as const;

const RESEARCH_PREFIX = "AI-RESEARCH:";

function researchTopic(qualityNotes: string | null, caption: string) {
  const topic = qualityNotes?.startsWith(RESEARCH_PREFIX) ? qualityNotes.slice(RESEARCH_PREFIX.length).trim() : "";
  return topic || caption.split("\n")[0].slice(0, 80);
}

export async function getCreativeHistoryData({
  facebookPageId,
  includeAccountRuns,
  now = new Date(),
}: {
  facebookPageId: string;
  /** Account-wide rows follow the same owner gate the overview uses. */
  includeAccountRuns: boolean;
  now?: Date;
}) {
  const since = new Date(now.getTime() - LOOKBACK_DAYS * 86400000);

  const [signalRows, generations, drafts, jobRuns] = await Promise.all([
    includeAccountRuns
      ? prisma.intelligenceSignal.findMany({
          where: { fetchedAt: { gte: since } },
          orderBy: { fetchedAt: "desc" },
          take: SIGNAL_SCAN_LIMIT,
          select: { source: true, topic: true, fetchedAt: true },
        })
      : Promise.resolve([]),
    prisma.contentGeneration.findMany({
      where: { facebookPageId, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        postId: true,
        model: true,
        mode: true,
        humanScore: true,
        userAccepted: true,
        createdAt: true,
        // Naming the post it produced is the useful part; a generation whose
        // post was deleted keeps postId null and stays unnamed.
        post: { select: { title: true, caption: true } },
      },
    }),
    prisma.post.findMany({
      where: { facebookPageId, createdAt: { gte: since }, qualityNotes: { startsWith: RESEARCH_PREFIX } },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, title: true, caption: true, qualityNotes: true, status: true, postType: true, createdAt: true },
    }),
    includeAccountRuns
      ? prisma.jobRun.findMany({
          where: { name: { in: [...CONTENT_JOB_NAMES] }, startedAt: { gte: since } },
          orderBy: { startedAt: "desc" },
          take: 30,
          select: { id: true, name: true, status: true, trigger: true, summary: true, error: true, startedAt: true, completedAt: true },
        })
      : Promise.resolve([]),
  ]);

  const syncRuns: SyncRun[] = foldSyncRuns(
    signalRows.map((row) => ({ source: row.source, topic: row.topic, fetchedAt: row.fetchedAt.toISOString() })),
  );

  const syncEntries: HistoryEntry[] = syncRuns.map((run) => ({
    key: `sync:${run.key}`,
    kind: "sync",
    at: run.startedAt,
    // The source is the most useful fact about a run, so it leads the title.
    title: `${label(SIGNAL_SOURCE_LABELS, run.source)} · ${run.topicCount} chủ đề`,
    detail: run.sampleTopics.join(" · "),
  }));

  const generationEntries: HistoryEntry[] = generations.map((row) => ({
    key: `gen:${row.id}`,
    kind: "generation",
    at: row.createdAt.toISOString(),
    title: row.post
      ? row.post.title?.trim() || row.post.caption.split("\n")[0].slice(0, 70)
      : "Sinh nội dung (bài đã xóa)",
    // Only fields that were actually stored; a null model stays unnamed.
    detail: [
      row.model ?? null,
      `chế độ ${row.mode}`,
      row.humanScore > 0 ? `điểm human ${row.humanScore}` : null,
      row.userAccepted === true ? "đã nhận" : row.userAccepted === false ? "đã bỏ" : null,
    ]
      .filter(Boolean)
      .join(" · "),
    postId: row.postId ?? undefined,
  }));

  const draftEntries: HistoryEntry[] = drafts.map((row) => ({
    key: `draft:${row.id}`,
    kind: "draft",
    at: row.createdAt.toISOString(),
    title: row.title?.trim() || researchTopic(row.qualityNotes, row.caption),
    detail: label(POST_TYPE_LABELS, row.postType),
    postId: row.id,
    status: row.status,
  }));

  const jobEntries: HistoryEntry[] = jobRuns.map((row) => ({
    key: `job:${row.id}`,
    kind: "job",
    at: row.startedAt.toISOString(),
    title: row.name,
    detail: [
      row.summary ?? null,
      row.completedAt ? `${Math.max(0, Math.round((row.completedAt.getTime() - row.startedAt.getTime()) / 1000))}s` : "chưa xong",
      row.trigger,
    ]
      .filter(Boolean)
      .join(" · "),
    status: row.status,
    error: row.error,
  }));

  return {
    timeline: mergeTimeline([syncEntries, generationEntries, draftEntries, jobEntries], TIMELINE_LIMIT),
    /** Counts describe the lookback window only, and say so in the UI. */
    stats: {
      lookbackDays: LOOKBACK_DAYS,
      syncRuns: syncRuns.length,
      topicsCollected: signalRows.length,
      generations: generations.length,
      researchDrafts: drafts.length,
      failedJobs: jobRuns.filter((row) => row.status === "failed" || row.status === "error").length,
    },
    /** Latest run per source, so a stale source is visible. */
    sources: [...syncRuns.reduce((acc, run) => {
      const existing = acc.get(run.source);
      if (!existing || run.startedAt > existing.lastRunAt) {
        acc.set(run.source, { runs: (existing?.runs ?? 0) + 1, lastRunAt: run.startedAt, topics: run.topicCount });
      } else {
        acc.set(run.source, { ...existing, runs: existing.runs + 1 });
      }
      return acc;
    }, new Map<string, { runs: number; lastRunAt: string; topics: number }>())]
      .map(([source, value]) => ({ source, ...value }))
      .sort((a, b) => b.lastRunAt.localeCompare(a.lastRunAt)),
    includeAccountRuns,
  };
}

export type CreativeHistoryData = Awaited<ReturnType<typeof getCreativeHistoryData>>;
