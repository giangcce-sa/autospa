/**
 * Post brief helpers. The brief arrays (outline, hooks, topicTags,
 * targetChannels) are stored as JSON strings to match the rest of the schema,
 * so every reader needs the same tolerant parse: a malformed or legacy value
 * must degrade to an empty list, never throw and never surface as raw JSON.
 *
 * Pure module (no prisma, no server-only) so it is unit-testable.
 */

export const BRIEF_LIMITS = {
  title: 200,
  summary: 1000,
  outlineItems: 20,
  hookItems: 10,
  topicTagItems: 12,
  itemLength: 300,
  tagLength: 60,
} as const;

/** Tolerant read of a JSON-string array column. */
export function parseBriefArray(raw: string | null | undefined, maxItems: number = BRIEF_LIMITS.outlineItems): string[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

export interface PostBrief {
  title: string | null;
  summary: string | null;
  outline: string[];
  hooks: string[];
  topicTags: string[];
  targetChannels: string[];
}

/** Normalises the six stored brief columns into a render-ready shape. */
export function readPostBrief(row: {
  title?: string | null;
  summary?: string | null;
  outline?: string | null;
  hooks?: string | null;
  topicTags?: string | null;
  targetChannels?: string | null;
}): PostBrief {
  return {
    title: row.title?.trim() || null,
    summary: row.summary?.trim() || null,
    outline: parseBriefArray(row.outline, BRIEF_LIMITS.outlineItems),
    hooks: parseBriefArray(row.hooks, BRIEF_LIMITS.hookItems),
    topicTags: parseBriefArray(row.topicTags, BRIEF_LIMITS.topicTagItems),
    targetChannels: parseBriefArray(row.targetChannels, 4),
  };
}

export function briefIsEmpty(brief: PostBrief) {
  return !brief.title && !brief.summary && brief.outline.length === 0 && brief.hooks.length === 0;
}

/** "1.2 MB" / "812 KB" — for attachment cards. */
export function formatBytes(bytes: number | null | undefined): string | null {
  if (bytes === null || bytes === undefined || bytes < 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/** "00:45" / "1:02:03" — for video attachments. */
export function formatDuration(seconds: number | null | undefined): string | null {
  if (seconds === null || seconds === undefined || seconds < 0) return null;
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${pad(minutes)}:${pad(secs)}`;
}

/** "MP4" / "JPG" from a mime type, for the format chip. */
export function formatLabelFromMime(mimeType: string | null | undefined): string | null {
  if (!mimeType) return null;
  const subtype = mimeType.split("/")[1];
  if (!subtype) return null;
  const cleaned = subtype.split(";")[0].replace("quicktime", "mov").replace("jpeg", "jpg");
  return cleaned.toUpperCase();
}
