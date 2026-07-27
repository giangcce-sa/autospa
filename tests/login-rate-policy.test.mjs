import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  BOOTSTRAP_IP_LIMIT,
  bootstrapIpKey,
  firstForwardedIp,
  isLockedOut,
  LOGIN_FAIL_LIMIT,
  LOGIN_IP_FAIL_LIMIT,
  loginEmailKey,
  loginIpKey,
  normalizeLoginEmail,
} from "../src/lib/login-rate-policy.ts";

test("email normalization trims and lowercases", () => {
  assert.equal(normalizeLoginEmail("  Chu@Spa.COM "), "chu@spa.com");
  assert.equal(loginEmailKey(" Chu@Spa.COM"), "login:email:chu@spa.com");
});

test("ip keys fall back to unknown", () => {
  assert.equal(loginIpKey("203.0.113.9"), "login:ip:203.0.113.9");
  assert.equal(loginIpKey(null), "login:ip:unknown");
  assert.equal(bootstrapIpKey(""), "bootstrap:ip:unknown");
});

test("firstForwardedIp takes the first hop only", () => {
  assert.equal(firstForwardedIp("203.0.113.9, 10.0.0.1"), "203.0.113.9");
  assert.equal(firstForwardedIp(" 203.0.113.9 "), "203.0.113.9");
  assert.equal(firstForwardedIp(""), null);
  assert.equal(firstForwardedIp(null), null);
  assert.equal(firstForwardedIp(undefined), null);
  assert.equal(firstForwardedIp(","), null);
});

test("isLockedOut requires an active window with spent budget", () => {
  assert.equal(isLockedOut(null), false);
  assert.equal(isLockedOut({ remaining: 3, windowEndsIn: 100 }), false);
  assert.equal(isLockedOut({ remaining: 0, windowEndsIn: 100 }), true);
  assert.equal(isLockedOut({ remaining: 0, windowEndsIn: 0 }), false);
});

test("limits stay in a sane relationship", () => {
  assert.ok(LOGIN_FAIL_LIMIT >= 5, "per-email budget must tolerate normal typos");
  assert.ok(LOGIN_IP_FAIL_LIMIT > LOGIN_FAIL_LIMIT, "ip budget must exceed email budget (shared NAT)");
  assert.ok(BOOTSTRAP_IP_LIMIT <= 10, "bootstrap must stay tight");
});

test("authorize flow: lockout check first, dummy-hash compare, failure counting, success reset", async () => {
  const source = await readFile(new URL("../src/lib/auth.ts", import.meta.url), "utf8");

  const lockoutAt = source.indexOf("isLockedOut(");
  const findUserAt = source.indexOf("prisma.user.findUnique");
  const compareAt = source.indexOf("bcrypt.compare(password, user.hashedPwd)");
  assert.ok(lockoutAt > -1 && findUserAt > -1 && compareAt > -1);
  assert.ok(lockoutAt < findUserAt, "lockout must be decided before touching the user row");
  assert.ok(findUserAt < compareAt);

  assert.match(source, /bcrypt\.compare\(password, DUMMY_HASH\)/, "missing-user path must burn a bcrypt round");
  assert.match(source, /class LoginLockedError extends CredentialsSignin/);
  assert.match(source, /code = "locked"/);
  assert.match(source, /recordLoginFailure\(email, ip\)/);
  assert.match(source, /resetBucket\(loginEmailKey\(email\)\)/, "success must reset the email fail bucket");
});

test("bootstrap route: rate limited, serializable, 8-char minimum, no raw error leak", async () => {
  const source = await readFile(new URL("../src/app/api/auth/bootstrap/route.ts", import.meta.url), "utf8");
  assert.match(source, /checkAndIncrement\(bootstrapIpKey\(ip\)/);
  assert.match(source, /status: 429/);
  assert.match(source, /isolationLevel: "Serializable"/);
  assert.match(source, /password\.length < 8/);
  assert.doesNotMatch(source, /err\.message/);
});
