import test from "node:test";
import assert from "node:assert/strict";

import {
  MIN_PHRASE_LENGTH,
  countMatchingSources,
  findMatchingTopic,
  normalizeTopic,
  topicsMatch,
} from "../src/lib/topic-match.ts";

test("normalizeTopic lowercases and strips punctuation but keeps diacritics", () => {
  assert.equal(normalizeTopic("  Phun Môi   Collagen! "), "phun môi collagen");
  assert.equal(normalizeTopic("Trị mụn — 2026"), "trị mụn 2026");
  assert.equal(normalizeTopic("!!!"), "");
});

test("identical topics match regardless of case and spacing", () => {
  assert.equal(topicsMatch("Phun môi", "  phun   môi "), true);
});

test("whole-phrase containment matches; partial words do not", () => {
  assert.equal(topicsMatch("phun môi", "phun môi collagen"), true);
  assert.equal(topicsMatch("phun môi collagen", "phun môi"), true, "order of arguments does not matter");
  // "trị mụn" is not a whole phrase inside "trị mụng" — no mid-word matches.
  assert.equal(topicsMatch("trị mụn", "trị mụng lưng"), false);
  assert.equal(topicsMatch("nâng mũi", "phun môi collagen"), false);
});

test("a phrase shorter than the floor cannot establish a match", () => {
  assert.ok(MIN_PHRASE_LENGTH === 4);
  // "spa" would otherwise match every caption mentioning a spa.
  assert.equal(topicsMatch("spa", "spa cao cấp quận 1"), false);
  assert.equal(topicsMatch("spa", "spa"), true, "exact equality still matches");
});

test("empty or punctuation-only topics never match", () => {
  assert.equal(topicsMatch("", "phun môi"), false);
  assert.equal(topicsMatch("???", "phun môi"), false);
  assert.equal(topicsMatch("", ""), false);
});

test("countMatchingSources counts distinct sources, not rows", () => {
  const signals = [
    { source: "google_trends", topic: "Phun môi collagen" },
    { source: "google_trends", topic: "phun môi" },
    { source: "fb_ads_library", topic: "phun môi" },
    { source: "fb_ads_library", topic: "nâng mũi" },
  ];
  assert.equal(countMatchingSources("phun môi", signals), 2, "two sources, four rows");
  assert.equal(countMatchingSources("nâng mũi", signals), 1);
  assert.equal(countMatchingSources("triệt lông", signals), 0, "a topic absent from the set");
});

test("countMatchingSources under-counts rather than inventing corroboration", () => {
  // Different wording for arguably the same topic stays at one source, by design.
  const signals = [
    { source: "google_trends", topic: "Xu hướng làm đẹp mùa hè" },
    { source: "fb_ads_library", topic: "chăm sóc da mùa hè" },
  ];
  assert.equal(countMatchingSources("Xu hướng làm đẹp mùa hè", signals), 1);
});

test("findMatchingTopic returns the item or null, never a fuzzy best guess", () => {
  const holidays = [
    { id: "h1", name: "Tết Trung Thu" },
    { id: "h2", name: "Quốc tế Phụ nữ" },
  ];
  assert.equal(findMatchingTopic("Tết Trung Thu 2026", holidays, (h) => h.name).id, "h1");
  assert.equal(findMatchingTopic("Phun môi collagen", holidays, (h) => h.name), null);
  assert.equal(findMatchingTopic("bất kỳ", [], (h) => h.name), null);
});
