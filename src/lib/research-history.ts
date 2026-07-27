/**
 * Recovering research history from append-only rows.
 *
 * The app never wrote a "research run" record, but `IntelligenceSignal` is
 * append-only and every row carries its own `fetchedAt`, so the runs are
 * derivable: rows from one source written within seconds of each other were one
 * sync. This groups them back into runs rather than inventing a run table.
 *
 * The grouping is a reconstruction, not a stored fact. Two syncs of the same
 * source started within RUN_GAP_MS of each other would merge into one run — the
 * error direction is under-counting runs, never inventing them.
 *
 * Pure module (no prisma, no server-only) so it is unit-testable.
 */

/** Rows further apart than this belong to different runs. */
export const RUN_GAP_MS = 120_000;

export interface SignalRow {
  source: string;
  topic: string;
  fetchedAt: string;
}

export interface SyncRun {
  /** Stable key: source + the run's first timestamp. */
  key: string;
  source: string;
  startedAt: string;
  endedAt: string;
  /** Distinct topics collected in this run. */
  topicCount: number;
  /** Up to a handful of topic names, for showing what the run found. */
  sampleTopics: string[];
}

const SAMPLE_LIMIT = 4;

/**
 * Groups signal rows into per-source runs, newest run first. Rows with an
 * unparseable timestamp are dropped rather than placed arbitrarily in time.
 */
export function foldSyncRuns(rows: SignalRow[], gapMs: number = RUN_GAP_MS): SyncRun[] {
  const bySource = new Map<string, Array<{ topic: string; at: number; iso: string }>>();
  for (const row of rows) {
    const at = new Date(row.fetchedAt).getTime();
    if (!Number.isFinite(at)) continue;
    const bucket = bySource.get(row.source);
    const entry = { topic: row.topic, at, iso: row.fetchedAt };
    if (bucket) bucket.push(entry);
    else bySource.set(row.source, [entry]);
  }

  const runs: SyncRun[] = [];
  for (const [source, entries] of bySource) {
    entries.sort((a, b) => a.at - b.at);
    let current: typeof entries = [];
    const flush = () => {
      if (current.length === 0) return;
      const topics = new Set(current.map((entry) => entry.topic));
      const first = current[0];
      const last = current[current.length - 1];
      runs.push({
        key: `${source}|${first.iso}`,
        source,
        startedAt: first.iso,
        endedAt: last.iso,
        topicCount: topics.size,
        sampleTopics: [...topics].slice(0, SAMPLE_LIMIT),
      });
      current = [];
    };
    for (const entry of entries) {
      if (current.length > 0 && entry.at - current[current.length - 1].at > gapMs) flush();
      current.push(entry);
    }
    flush();
  }

  return runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export type HistoryKind = "sync" | "draft" | "generation" | "job";

export interface HistoryEntry {
  key: string;
  kind: HistoryKind;
  /** ISO timestamp the entry is ordered by. */
  at: string;
  title: string;
  /** Short factual detail; empty string when there is nothing stored to say. */
  detail: string;
  /** Populated only for entries that link somewhere real. */
  postId?: string;
  status?: string;
  error?: string | null;
}

/** Merges typed entries into one newest-first timeline. */
export function mergeTimeline(groups: HistoryEntry[][], limit: number): HistoryEntry[] {
  return groups
    .flat()
    .filter((entry) => Number.isFinite(new Date(entry.at).getTime()))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);
}
