import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_TRIGGER,
  asStringArray,
  clamp01,
  extractJson,
  inferDraft,
  normalizeDraft,
  normalizePermission,
  normalizeRisk,
} from "../src/lib/brain-policy.ts";

test("clamp01 clamps numbers into [0,1] and falls back on non-numeric input", () => {
  assert.equal(clamp01(0.5, 0.1), 0.5);
  assert.equal(clamp01(2, 0.1), 1);
  assert.equal(clamp01(-1, 0.1), 0);
  assert.equal(clamp01("0.7", 0.1), 0.7);
  assert.equal(clamp01("abc", 0.3), 0.3);
  assert.equal(clamp01(undefined, 0.3), 0.3);
});

test("normalizeRisk only accepts the three known levels", () => {
  assert.equal(normalizeRisk("high"), "high");
  assert.equal(normalizeRisk("medium"), "medium");
  assert.equal(normalizeRisk("low"), "low");
  assert.equal(normalizeRisk("critical"), "medium");
  assert.equal(normalizeRisk(undefined), "medium");
});

test("normalizePermission blocks auto escalation for non-low risk", () => {
  assert.equal(normalizePermission("auto", "medium"), "supervised");
  assert.equal(normalizePermission("auto", "high"), "supervised");
  assert.equal(normalizePermission("auto", "low"), "auto");
  assert.equal(normalizePermission("supervised", "low"), "supervised");
  assert.equal(normalizePermission("draft", "high"), "draft");
  assert.equal(normalizePermission("suggest", "medium"), "suggest");
  assert.equal(normalizePermission(undefined, "high"), "supervised");
  assert.equal(normalizePermission(undefined, "low"), "draft");
  assert.equal(normalizePermission("bogus", "medium"), "draft");
});

test("asStringArray trims, drops empties, stringifies, and caps at 12", () => {
  assert.deepEqual(asStringArray(["a", " b ", "", 3], ["x"]), ["a", "b", "3"]);
  assert.deepEqual(asStringArray("not-an-array", ["x"]), ["x"]);
  assert.deepEqual(asStringArray(undefined), []);
  assert.equal(asStringArray(Array.from({ length: 15 }, (_, i) => `t${i}`)).length, 12);
});

test("inferDraft routes domains and risk from Vietnamese keywords", () => {
  const sales = inferDraft("Theo dõi lead mới và nhắc nhân viên trong ngày");
  assert.equal(sales.domain, "sales");
  assert.equal(sales.riskLevel, "medium"); // "lead" is a medium-risk keyword
  assert.deepEqual(sales.tools, ["crm", "inbox", "zalo"]);
  assert.equal(sales.successMetric, "reply_rate, booking_rate");
  assert.equal(sales.triggerType, "time_based"); // "ngày"

  const ads = inferDraft("Tăng ngân sách quảng cáo khi CTR cao");
  assert.equal(ads.domain, "ads");
  assert.equal(ads.riskLevel, "high");
  assert.equal(ads.permissionLevel, "supervised"); // high risk defaults to supervised
  assert.equal(ads.triggerType, "manual");

  const content = inferDraft("Viết caption khuyến mãi mỗi tuần");
  assert.equal(content.domain, "content");
  assert.deepEqual(content.tools, ["content", "publish"]);
  assert.equal(content.successMetric, "engagement_rate");
  assert.equal(content.triggerType, "time_based"); // "tuần"

  const intelligence = inferDraft("Phân tích đối thủ viral để rút insight");
  assert.equal(intelligence.domain, "intelligence");
  assert.equal(intelligence.riskLevel, "low");
  assert.equal(intelligence.permissionLevel, "draft"); // low risk defaults to draft
  assert.equal(intelligence.successMetric, "completion_rate");

  assert.equal(inferDraft("Backup toàn bộ hồ sơ nội bộ").domain, "operation");
});

test("inferDraft trims trailing dots from the name and keeps sane defaults", () => {
  const draft = inferDraft("Kiểm tra caption trước khi đăng.");
  assert.equal(draft.name, "Kiểm tra caption trước khi đăng");
  assert.equal(draft.confidence, 0.58);
  assert.equal(draft.classificationConfidence, 0.58);
  assert.deepEqual(draft.triggerConfig, DEFAULT_TRIGGER);
  assert.deepEqual(draft.inputSignals, []);
});

test("normalizeDraft clamps confidence, truncates long fields, and guards permissions", () => {
  const instruction = "Viết caption khuyến mãi mỗi tuần";
  const normalized = normalizeDraft({
    name: "N".repeat(150),
    description: "D".repeat(600),
    playbook: "P".repeat(5000),
    confidence: 5,
    classificationConfidence: -2,
    permissionLevel: "auto",
    riskLevel: "medium",
  }, instruction);

  assert.equal(normalized.name.length, 100);
  assert.equal(normalized.description.length, 500);
  assert.equal(normalized.playbook.length, 4000);
  assert.equal(normalized.confidence, 1);
  assert.equal(normalized.classificationConfidence, 0);
  assert.equal(normalized.permissionLevel, "supervised"); // auto + medium risk is blocked
  assert.equal(normalized.riskLevel, "medium");

  const allowed = normalizeDraft({ permissionLevel: "auto", riskLevel: "low" }, instruction);
  assert.equal(allowed.permissionLevel, "auto");
});

test("normalizeDraft falls back per-field to the rule-based draft", () => {
  const instruction = "Viết caption khuyến mãi mỗi tuần";
  const fallback = inferDraft(instruction);
  const normalized = normalizeDraft({}, instruction);

  assert.deepEqual(normalized, {
    ...fallback,
    // Invalid category for the domain falls back to the domain's first category.
    category: fallback.category,
  });

  // Unknown domain falls back to "operation", and its category resets accordingly.
  const unknownDomain = normalizeDraft({ domain: "hacking" }, instruction);
  assert.equal(unknownDomain.domain, "operation");
  assert.equal(unknownDomain.category, "approval");
});

test("extractJson pulls the JSON object out of AI chatter and throws without one", () => {
  assert.deepEqual(extractJson('Đây là kết quả: {"a": 1} — hết.'), { a: 1 });
  assert.throws(() => extractJson("không có json nào ở đây"), /AI không trả JSON/);
});
