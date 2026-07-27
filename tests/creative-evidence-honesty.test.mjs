import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * Source-text invariants for the evidence layer of the ideas workspace.
 *
 * The rule these protect: every number the user sees is a measurement of stored
 * data, and a factor with nothing to measure is reported as absent rather than
 * as zero. These are cheap to break during a refactor and expensive to notice,
 * so they are pinned here rather than left to review.
 */

const ROOT = new URL("../", import.meta.url);
const read = (relative) => readFile(new URL(relative, ROOT), "utf8");

test("the score never reads raw volume, which is not comparable across sources", async () => {
  const source = await read("src/lib/idea-score.ts");
  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  assert.doesNotMatch(code, /\bvolume\b/, "idea-score.ts must not consume IntelligenceSignal.volume");
});

test("a missing competitor or holiday match stays null, never coerced to zero", async () => {
  const source = await read("src/lib/creative-ideas.ts");
  assert.match(
    source,
    /competitorCount:\s*competitorMatch\s*\?\s*competitorMatch\.count\s*:\s*null/,
    "an unmatched competitor topic must be null (no data), not 0",
  );
  assert.match(
    source,
    /holidayDaysUntil:\s*holidayMatch\s*\?\s*holidayMatch\.daysUntil\s*:\s*null/,
    "an unmatched holiday must be null (no data), not 0",
  );
  assert.doesNotMatch(source, /competitorCount:\s*[^;\n]*\?\?\s*0/, "?? 0 would turn 'no data' into a measurement");
});

test("trends are ranked by the explainable score, never by raw volume", async () => {
  const source = await read("src/lib/creative-ideas.ts");
  assert.match(source, /b\.score\.score\s*-\s*a\.score\.score/, "the primary sort key is the score");
  const sortBlock = source.slice(source.indexOf(".sort((a, b) =>"));
  assert.doesNotMatch(sortBlock.slice(0, 600), /\.volume/, "volume must not influence ordering");
});

test("the score UI renders precomputed points and does no arithmetic of its own", async () => {
  const source = await read("src/components/modules/creative/IdeaEvidence.tsx");
  // Allowed: rendering points/maxPoints as a bar width. Not allowed: deriving a
  // score, an average, or a weight in the component.
  assert.doesNotMatch(source, /avgEngagement\s*\*/, "averages are computed in content-benchmark.ts");
  assert.doesNotMatch(source, /SCORE_WEIGHTS/, "weights belong to idea-score.ts only");
  assert.match(source, /entry\.points\}\/\$\{entry\.maxPoints/, "points are shown against their own ceiling");
});

test("a factor with no data is rendered as absent, not as zero", async () => {
  const source = await read("src/components/modules/creative/IdeaEvidence.tsx");
  assert.match(source, /entry\.hasData\s*\?\s*`\$\{entry\.points\}\/\$\{entry\.maxPoints\}`\s*:\s*"—"/);
});

test("the benchmark states plainly that it is measured, not predicted", async () => {
  const source = await read("src/components/modules/creative/IdeaEvidence.tsx");
  assert.match(source, /không phải dự đoán/, "the caption must disclaim prediction");
  assert.match(source, /MIN_BENCHMARK_SAMPLES/, "the empty state must name the sample floor");
});

test("channel suggestions are gated on real credentials", async () => {
  const readModel = await read("src/lib/creative-ideas.ts");
  assert.match(readModel, /getConnectedChannels\(facebookPageId\)/, "connectivity comes from stored credentials");

  // The resolver lives in one place so no screen invents its own channel list.
  const resolver = await read("src/lib/connected-channels.ts");
  assert.match(resolver, /resolveConnectedChannels\(/);
  assert.match(resolver, /hasZaloToken:\s*!!settings\?\.zaloToken/, "presence only — the token is encrypted at rest");
  assert.doesNotMatch(resolver, /return\s+settings\?\.zaloToken/, "the secret value must never be returned");
  const component = await read("src/components/modules/creative/IdeaEvidence.tsx");
  assert.match(
    component,
    /suggestChannels\(\{\s*connected,\s*wordCount,\s*history,\s*targetChannels\s*\}\)/,
    "the ranked list must come from suggestChannels over the connected list",
  );
  assert.doesNotMatch(component, /PLATFORM_LENGTH_RANGES/, "length thresholds stay in channel-fit.ts");
  assert.doesNotMatch(component, /"(facebook|zalo|tiktok|instagram)"/, "no hardcoded channel names in the UI");
});

test("no fabricated forecast label survives anywhere in src", async () => {
  const banned = [
    "Hiệu quả dự kiến",
    "Dự kiến hiệu quả",
    "Tiềm năng 92",
    "Trend tăng 210",
    "Reach dự kiến",
  ];
  const files = [];
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
    }
  }
  await walk(fileURLToPath(new URL("src", ROOT)));
  assert.ok(files.length > 100, `expected to scan the whole src tree, saw ${files.length} files`);

  const offenders = [];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    for (const phrase of banned) {
      // content-benchmark.ts names the removed label in its own header comment.
      if (source.includes(phrase) && !file.endsWith("content-benchmark.ts")) {
        offenders.push(`${file}: ${phrase}`);
      }
    }
  }
  assert.deepEqual(offenders, [], "a predicted-performance label reappeared");
});
