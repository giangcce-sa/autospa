import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  MIN_HISTORY_SAMPLES,
  PLATFORM_LENGTH_RANGES,
  countWords,
  lengthFitFor,
  resolveConnectedChannels,
  suggestChannels,
} from "../src/lib/channel-fit.ts";

test("countWords matches the reviewer's whitespace split", () => {
  assert.equal(countWords("Ưu đãi phun môi collagen"), 5);
  assert.equal(countWords("  nhiều   khoảng   trắng  "), 3);
  assert.equal(countWords("dòng một\ndòng hai"), 4, "newlines are whitespace too");
  assert.equal(countWords(""), 0);
  assert.equal(countWords("   "), 0);
});

test("a channel is connected only when its credential is actually stored", () => {
  assert.deepEqual(resolveConnectedChannels({ hasFacebookPage: false }), []);
  assert.deepEqual(resolveConnectedChannels({ hasFacebookPage: true }), ["facebook"]);
  assert.deepEqual(
    resolveConnectedChannels({
      hasFacebookPage: true,
      hasInstagramAccount: true,
      hasZaloToken: true,
      hasZaloOaId: true,
      activeTiktokAccounts: 1,
    }),
    ["facebook", "instagram", "zalo", "tiktok"],
  );
  // Half-configured Zalo is not a connection.
  assert.deepEqual(resolveConnectedChannels({ hasFacebookPage: true, hasZaloToken: true }), ["facebook"]);
  assert.deepEqual(resolveConnectedChannels({ hasFacebookPage: true, hasZaloOaId: true }), ["facebook"]);
  // An inactive TikTok account is not a connection.
  assert.deepEqual(resolveConnectedChannels({ hasFacebookPage: true, activeTiktokAccounts: 0 }), ["facebook"]);
});

test("length ranges do not drift from the reviewer's own thresholds", async () => {
  // The reviewer is the single source of truth for "too short / too long".
  const source = await readFile(new URL("../src/lib/reviewer.ts", import.meta.url), "utf8");
  for (const [platform, range] of Object.entries(PLATFORM_LENGTH_RANGES)) {
    const pattern = new RegExp(
      `${platform}:\\s*\\{\\s*min:\\s*${range.min},\\s*max:\\s*${range.max},\\s*ideal:\\s*\\[${range.ideal[0]},\\s*${range.ideal[1]}\\]`,
    );
    assert.match(source, pattern, `${platform} range drifted from reviewer.ts`);
  }
});

test("lengthFitFor classifies against the platform range", () => {
  assert.equal(lengthFitFor("tiktok", 10), "too_short");
  assert.equal(lengthFitFor("tiktok", 50), "ideal");
  assert.equal(lengthFitFor("tiktok", 150), "ok");
  assert.equal(lengthFitFor("tiktok", 500), "too_long");
  assert.equal(lengthFitFor("facebook", 200), "ideal");
  // Unknown platforms fall back to the facebook range rather than throwing.
  assert.equal(lengthFitFor("threads", 200), "ideal");
});

test("only connected channels are ever suggested", () => {
  const rows = suggestChannels({ connected: ["facebook", "zalo"], wordCount: 120 });
  assert.deepEqual(rows.map((row) => row.channel).sort(), ["facebook", "zalo"]);
  assert.equal(rows.every((row) => row.rank > 0), true);
});

test("no connected channel yields no suggestion at all", () => {
  assert.deepEqual(suggestChannels({ connected: [], wordCount: 120 }), []);
});

test("measured history outranks length fit", () => {
  const rows = suggestChannels({
    connected: ["facebook", "tiktok"],
    wordCount: 40, // ideal for tiktok, too short for facebook
    history: [{ platform: "facebook", avgEngagement: 12.5, sampleCount: 30 }],
  });
  assert.equal(rows[0].channel, "facebook", "a channel with measured history wins");
  assert.equal(rows[0].measuredEngagement, 12.5);
  assert.equal(rows[1].channel, "tiktok");
  assert.equal(rows[1].measuredEngagement, null);
});

test("thin history is reported, not used", () => {
  const rows = suggestChannels({
    connected: ["facebook"],
    wordCount: 200,
    history: [{ platform: "facebook", avgEngagement: 99, sampleCount: MIN_HISTORY_SAMPLES - 1 }],
  });
  assert.equal(rows[0].measuredEngagement, null, "below the sample floor it must not be used");
  assert.equal(rows[0].sampleCount, MIN_HISTORY_SAMPLES - 1);
  assert.match(rows[0].reasons[0], /chưa đủ/i);
});

test("with two measured channels the higher engagement ranks first", () => {
  const rows = suggestChannels({
    connected: ["facebook", "zalo"],
    wordCount: 120,
    history: [
      { platform: "facebook", avgEngagement: 8, sampleCount: 10 },
      { platform: "zalo", avgEngagement: 20, sampleCount: 10 },
    ],
  });
  assert.deepEqual(rows.map((row) => row.channel), ["zalo", "facebook"]);
});

test("without history, better length fit ranks first; targeting breaks ties", () => {
  const byFit = suggestChannels({ connected: ["facebook", "tiktok"], wordCount: 40 });
  assert.equal(byFit[0].channel, "tiktok", "40 words is ideal for tiktok, too short for facebook");

  const tie = suggestChannels({ connected: ["facebook", "instagram"], wordCount: 150, targetChannels: ["instagram"] });
  assert.equal(tie[0].channel, "instagram", "an explicitly targeted channel wins an otherwise equal tie");
  assert.equal(tie[0].targeted, true);
});

test("every suggestion carries a human-readable reason and never a predicted number", () => {
  const rows = suggestChannels({
    connected: ["facebook", "tiktok", "zalo"],
    wordCount: 120,
    history: [{ platform: "facebook", avgEngagement: 7.25, sampleCount: 12 }],
  });
  for (const row of rows) {
    assert.ok(row.reasons.length >= 2, "at least a data reason and a length reason");
    assert.ok(row.reasons.every((reason) => typeof reason === "string" && reason.length > 0));
    // The only number allowed is a measured average with its sample count.
    if (row.measuredEngagement === null) {
      assert.match(row.reasons[0], /Chưa có dữ liệu|chưa đủ/i);
    } else {
      assert.match(row.reasons[0], /đã đo/);
    }
  }
});
