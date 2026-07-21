import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeMetaPagingUrl } from "../src/lib/meta-graph-url.ts";

test("removes access tokens from Meta paging URLs", () => {
  const sanitized = sanitizeMetaPagingUrl(
    "https://graph.facebook.com/v21.0/act_123/campaigns?after=cursor&access_token=secret-token",
  );
  assert.equal(sanitized?.includes("secret-token"), false);
  assert.equal(sanitized?.includes("access_token"), false);
  assert.equal(new URL(sanitized).searchParams.get("after"), "cursor");
});

test("rejects paging URLs outside the Meta Graph origin", () => {
  assert.throws(
    () => sanitizeMetaPagingUrl("https://attacker.example/next?access_token=secret-token"),
    /không hợp lệ/,
  );
  assert.throws(
    () => sanitizeMetaPagingUrl("http://graph.facebook.com/v21.0/next"),
    /không hợp lệ/,
  );
});

test("returns null when Meta has no next page", () => {
  assert.equal(sanitizeMetaPagingUrl(undefined), null);
});
