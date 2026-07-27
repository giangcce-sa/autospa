import test from "node:test";
import assert from "node:assert/strict";

import {
  BRIEF_LIMITS,
  briefIsEmpty,
  formatBytes,
  formatDuration,
  formatLabelFromMime,
  parseBriefArray,
  readPostBrief,
} from "../src/lib/creative-brief.ts";

test("parseBriefArray tolerates every malformed shape instead of throwing", () => {
  assert.deepEqual(parseBriefArray('["a","b"]'), ["a", "b"]);
  assert.deepEqual(parseBriefArray("[]"), []);
  assert.deepEqual(parseBriefArray(null), []);
  assert.deepEqual(parseBriefArray(undefined), []);
  assert.deepEqual(parseBriefArray(""), []);
  assert.deepEqual(parseBriefArray("not json"), []);
  assert.deepEqual(parseBriefArray('{"a":1}'), [], "an object is not a list");
  assert.deepEqual(parseBriefArray('"plain string"'), []);
});

test("parseBriefArray trims, drops empties and non-strings", () => {
  assert.deepEqual(parseBriefArray('["  a  ","",null,3,"b"]'), ["a", "b"]);
});

test("parseBriefArray caps the item count", () => {
  const many = JSON.stringify(Array.from({ length: 40 }, (_, i) => `item ${i}`));
  assert.equal(parseBriefArray(many, 5).length, 5);
  assert.equal(parseBriefArray(many).length, BRIEF_LIMITS.outlineItems);
});

test("readPostBrief normalises all six columns", () => {
  const brief = readPostBrief({
    title: "  Quy trình peel an toàn  ",
    summary: "  Tóm tắt  ",
    outline: '["Bước 1","Bước 2"]',
    hooks: '["Hook A","Hook B","Hook C"]',
    topicTags: '["Kiến thức","Chăm sóc da"]',
    targetChannels: '["facebook","tiktok"]',
  });
  assert.equal(brief.title, "Quy trình peel an toàn");
  assert.equal(brief.summary, "Tóm tắt");
  assert.deepEqual(brief.outline, ["Bước 1", "Bước 2"]);
  assert.equal(brief.hooks.length, 3);
  assert.deepEqual(brief.topicTags, ["Kiến thức", "Chăm sóc da"]);
  assert.deepEqual(brief.targetChannels, ["facebook", "tiktok"]);
});

test("readPostBrief treats blank strings as absent", () => {
  const brief = readPostBrief({ title: "   ", summary: "", outline: null, hooks: null, topicTags: null, targetChannels: null });
  assert.equal(brief.title, null);
  assert.equal(brief.summary, null);
  assert.equal(briefIsEmpty(brief), true);
});

test("briefIsEmpty is false as soon as any narrative field exists", () => {
  const base = { title: null, summary: null, outline: null, hooks: null, topicTags: null, targetChannels: null };
  assert.equal(briefIsEmpty(readPostBrief({ ...base, title: "x" })), false);
  assert.equal(briefIsEmpty(readPostBrief({ ...base, summary: "x" })), false);
  assert.equal(briefIsEmpty(readPostBrief({ ...base, outline: '["x"]' })), false);
  assert.equal(briefIsEmpty(readPostBrief({ ...base, hooks: '["x"]' })), false);
  // tags alone are metadata, not a brief
  assert.equal(briefIsEmpty(readPostBrief({ ...base, topicTags: '["x"]' })), true);
});

test("formatBytes matches the attachment-card format", () => {
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(900), "900 B");
  assert.equal(formatBytes(1024), "1 KB");
  assert.equal(formatBytes(1_258_291), "1.2 MB");
  assert.equal(formatBytes(25_690_112), "24.5 MB");
  assert.equal(formatBytes(null), null);
  assert.equal(formatBytes(undefined), null);
  assert.equal(formatBytes(-5), null);
});

test("formatDuration pads and grows to hours", () => {
  assert.equal(formatDuration(45), "00:45");
  assert.equal(formatDuration(5), "00:05");
  assert.equal(formatDuration(75), "01:15");
  assert.equal(formatDuration(3723), "1:02:03");
  assert.equal(formatDuration(0), "00:00");
  assert.equal(formatDuration(null), null);
});

test("formatLabelFromMime yields the format chip text", () => {
  assert.equal(formatLabelFromMime("image/jpeg"), "JPG");
  assert.equal(formatLabelFromMime("image/png"), "PNG");
  assert.equal(formatLabelFromMime("video/mp4"), "MP4");
  assert.equal(formatLabelFromMime("video/quicktime"), "MOV");
  assert.equal(formatLabelFromMime("text/plain; charset=utf-8"), "PLAIN");
  assert.equal(formatLabelFromMime(null), null);
  assert.equal(formatLabelFromMime("garbage"), null);
});
