import assert from "node:assert/strict";
import test from "node:test";
import {
  bulkPlanInputSchema,
  bulkPlanPostCount,
  parseGeneratedBulkPosts,
} from "../src/lib/bulk-plan-policy.ts";

const input = bulkPlanInputSchema.parse({
  facebookPageId: "page-1",
  month: 8,
  year: 2026,
  postsPerWeek: 3,
  tone: "friendly",
  postTypes: ["service", "tip", "promotion"],
});

test("bulk plan input is bounded", () => {
  assert.equal(bulkPlanPostCount(2026, 8, 3), 13);
  assert.equal(bulkPlanInputSchema.safeParse({ ...input, month: 13 }).success, false);
  assert.equal(bulkPlanInputSchema.safeParse({ ...input, postsPerWeek: 20 }).success, false);
  assert.equal(bulkPlanInputSchema.safeParse({ ...input, tone: "robotic" }).success, false);
});

test("generated bulk posts accept fenced JSON and normalize values", () => {
  const expected = bulkPlanPostCount(input.year, input.month, input.postsPerWeek);
  const generated = Array.from({ length: expected }, (_, index) => ({
    day: String(index + 1),
    postType: "tip",
    caption: `  Caption E2E ${index + 1}  `,
    hashtags: "#e2e",
  }));
  const posts = parseGeneratedBulkPosts(`Here is the plan:\n\`\`\`json\n${JSON.stringify(generated)}\n\`\`\``, input);
  assert.equal(posts.length, expected);
  assert.deepEqual(posts[0], { day: 1, postType: "tip", caption: "Caption E2E 1", hashtags: "#e2e" });
});

test("generated bulk posts reject invalid JSON, excessive rows, and out-of-month days", () => {
  assert.throws(() => parseGeneratedBulkPosts("not-json", input), /danh sách bài viết hợp lệ/);
  const expected = bulkPlanPostCount(2026, 8, 3);
  const badDay = Array.from({ length: expected }, (_, index) => ({
    day: index === 0 ? 32 : index + 1,
    postType: "tip",
    caption: `Post ${index}`,
    hashtags: "",
  }));
  assert.throws(() => parseGeneratedBulkPosts(JSON.stringify(badDay), input), /ngày ngoài tháng/);
  const tooMany = Array.from({ length: expected + 1 }, (_, index) => ({
    day: (index % 31) + 1,
    postType: "tip",
    caption: `Post ${index}`,
    hashtags: "",
  }));
  assert.throws(() => parseGeneratedBulkPosts(JSON.stringify(tooMany), input), /cấu trúc không hợp lệ/);
});
