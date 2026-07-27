/**
 * Deciding whether two stored topic strings are the same topic.
 *
 * The research sources do not share a vocabulary: Google Trends stores a
 * trending headline ("Phun môi collagen"), the Ads Library stores a keyword from
 * a fixed list ("phun môi"), and CompetitorMemory stores a label extracted from
 * competitor captions. Any join between them is a judgement call, so the rule
 * here is deliberately STRICT: two topics match only when, after normalising,
 * one is the other or fully contains it as a whole phrase.
 *
 * The consequence is intentional. This UNDER-counts corroboration — a topic that
 * two sources really do cover under different wording will be reported as one
 * source. Under-counting understates an opportunity; loose token overlap would
 * invent corroboration that does not exist ("giảm giá" matching every
 * promotion). Understating is the acceptable error.
 *
 * Pure module (no prisma, no server-only) so it is unit-testable.
 */

/** Shortest phrase allowed to establish a match — below this, containment is noise. */
export const MIN_PHRASE_LENGTH = 4;

/** Lowercase, strip punctuation, collapse whitespace. Diacritics are preserved. */
export function normalizeTopic(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when `haystack` contains `needle` as a whole phrase (word-boundary aligned). */
function containsPhrase(haystack: string, needle: string) {
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) return false;
    const beforeOk = at === 0 || haystack[at - 1] === " ";
    const end = at + needle.length;
    const afterOk = end === haystack.length || haystack[end] === " ";
    if (beforeOk && afterOk) return true;
    from = at + 1;
  }
}

export function topicsMatch(a: string, b: string): boolean {
  const left = normalizeTopic(a);
  const right = normalizeTopic(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const shorter = left.length <= right.length ? left : right;
  const longer = shorter === left ? right : left;
  if (shorter.length < MIN_PHRASE_LENGTH) return false;
  return containsPhrase(longer, shorter);
}

/**
 * How many DISTINCT sources report this topic. Always at least 1 for a topic
 * that came from a stored signal, since that signal is itself a source.
 */
export function countMatchingSources(topic: string, signals: Array<{ source: string; topic: string }>): number {
  const sources = new Set<string>();
  for (const signal of signals) {
    if (topicsMatch(topic, signal.topic)) sources.add(signal.source);
  }
  return sources.size;
}

/** First item whose topic matches, or null. Callers must treat null as "no data". */
export function findMatchingTopic<T>(topic: string, items: T[], topicOf: (item: T) => string): T | null {
  return items.find((item) => topicsMatch(topic, topicOf(item))) ?? null;
}
