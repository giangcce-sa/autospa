import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { matchesPublicPath } from "../src/lib/public-paths.ts";

const PATHS = ["/login", "/setup", "/api/auth", "/api/media-public"];

test("matches exact path and nested segments", () => {
  assert.equal(matchesPublicPath("/login", PATHS), true);
  assert.equal(matchesPublicPath("/api/auth/callback/credentials", PATHS), true);
  assert.equal(matchesPublicPath("/api/media-public/images/a.mp4", PATHS), true);
});

test("rejects loose prefixes that startsWith would let through", () => {
  assert.equal(matchesPublicPath("/setup-admin", PATHS), false);
  assert.equal(matchesPublicPath("/api/auth-bypass", PATHS), false);
  assert.equal(matchesPublicPath("/loginx", PATHS), false);
  assert.equal(matchesPublicPath("/settings", PATHS), false);
});

test("proxy uses the segment matcher and lists signed media as public", async () => {
  const source = await readFile(new URL("../src/proxy.ts", import.meta.url), "utf8");
  assert.match(source, /matchesPublicPath\(pathname, PUBLIC_PATHS\)/);
  assert.doesNotMatch(source, /PUBLIC_PATHS\.some\(\(p\) => pathname\.startsWith\(p\)\)/);
  assert.match(source, /"\/api\/media-public"/);
  // deployment-readiness.test.mjs also requires these literals to stay in proxy.ts
  assert.match(source, /"\/api\/health"/);
  assert.match(source, /"\/api\/ready"/);
});
