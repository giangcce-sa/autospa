import test from "node:test";
import assert from "node:assert/strict";
import { getPublishStatus, pageScopeMatches, resolvePostPageId } from "../src/lib/page-scope-policy.ts";

test("page-scoped records cannot cross to another Page", () => {
  assert.equal(pageScopeMatches("page-a", "page-a"), true);
  assert.equal(pageScopeMatches("page-a", "page-b"), false);
  assert.equal(pageScopeMatches("page-a", undefined), false);
});

test("global records require an explicit policy allowance", () => {
  assert.equal(pageScopeMatches(null, "page-a"), false);
  assert.equal(pageScopeMatches(null, "page-a", { allowGlobalRecord: true }), true);
});

test("stored Post Page is authoritative and mismatch is rejected", () => {
  assert.equal(resolvePostPageId("page-a", undefined), "page-a");
  assert.equal(resolvePostPageId("page-a", "page-a"), "page-a");
  assert.equal(resolvePostPageId(undefined, "page-a"), "page-a");
  assert.equal(resolvePostPageId("page-a", "page-b"), null);
  assert.equal(resolvePostPageId(undefined, undefined), undefined);
});

test("publish status reflects required channel results", () => {
  assert.equal(getPublishStatus({ facebook: "fb-1" }, ["facebook"]), "published");
  assert.equal(getPublishStatus({ facebook: "error:denied" }, ["facebook"]), "publish_failed");
  assert.equal(
    getPublishStatus({ facebook: "fb-1", instagram: "error:not connected" }, ["facebook", "instagram"]),
    "partially_published",
  );
});
