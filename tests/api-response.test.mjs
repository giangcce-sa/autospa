import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import { routeErrorResponse, settingsErrorResponse } from "../src/lib/api-response.ts";
import { AccessError } from "../src/lib/access-error.ts";
import { AdsMutationBlockedError } from "../src/lib/ads-safety.ts";
import { ProviderUrlError } from "../src/lib/provider-url-validation.ts";

async function payload(res) {
  return { status: res.status, body: await res.json() };
}

test("AccessError keeps its message and status", async () => {
  const { status, body } = await payload(routeErrorResponse(new AccessError("Chưa đăng nhập", 401)));
  assert.equal(status, 401);
  assert.deepEqual(body, { success: false, error: "Chưa đăng nhập" });
});

test("AdsMutationBlockedError maps to 423 with operation", async () => {
  const { status, body } = await payload(routeErrorResponse(new AdsMutationBlockedError("Bị chặn", "pause_campaign")));
  assert.equal(status, 423);
  assert.equal(body.operation, "pause_campaign");
});

test("ZodError answers 400 with the first issue message", async () => {
  const schema = z.object({ email: z.string().min(1, "Thiếu email") });
  const zodError = schema.safeParse({ email: "" }).error;
  const { status, body } = await payload(routeErrorResponse(zodError));
  assert.equal(status, 400);
  assert.equal(body.error, "Thiếu email");
});

test("typed validation errors answer 400 with their own message", async () => {
  const { status, body } = await payload(routeErrorResponse(new ProviderUrlError("URL không hợp lệ")));
  assert.equal(status, 400);
  assert.equal(body.error, "URL không hợp lệ");
  const range = await payload(routeErrorResponse(new RangeError("Ngưỡng sai thứ tự")));
  assert.equal(range.status, 400);
});

test("unknown errors NEVER leak their message through routeErrorResponse", async () => {
  const { status, body } = await payload(routeErrorResponse(new Error("ECONNREFUSED 10.0.0.5:5432 — internal"), "Lỗi khi tải"));
  assert.equal(status, 500);
  assert.deepEqual(body, { success: false, error: "Lỗi khi tải" });
  const stringy = await payload(routeErrorResponse("raw string error"));
  assert.equal(stringy.body.error, "Đã xảy ra lỗi, thử lại sau");
});

test("settingsErrorResponse exposes Error.message (owner-only surfaces) but never stringifies non-Errors", async () => {
  const err = await payload(settingsErrorResponse(new Error("RUNWAY_API_KEY chưa được cấu hình")));
  assert.equal(err.status, 500);
  assert.equal(err.body.error, "RUNWAY_API_KEY chưa được cấu hình");
  assert.equal(err.body.message, err.body.error);
  const nonError = await payload(settingsErrorResponse({ weird: true }, "Cấu hình không hợp lệ"));
  assert.equal(nonError.body.error, "Cấu hình không hợp lệ");
  const custom = await payload(settingsErrorResponse(new Error("x"), "f", 502));
  assert.equal(custom.status, 502);
});

// Tree-wide guard: no route may stringify raw errors into a response payload again.
test("no API route leaks String(err) or err.message-with-String fallback", async () => {
  const apiRoot = fileURLToPath(new URL("../src/app/api", import.meta.url));
  const files = [];
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.name === "route.ts") files.push(full);
    }
  }
  await walk(apiRoot);
  assert.ok(files.length >= 120);

  const offenders = [];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    // Server-side console.error(...) with the raw error is fine; stringifying
    // into a payload variable/field is not.
    const stripped = source.replace(/console\.error\([^)]*\)/g, "");
    if (/instanceof Error \? \w+\.message : String\(/.test(stripped)) {
      offenders.push(`${path.relative(apiRoot, file)}: message-with-String fallback`);
    }
    // Object-property position only — a server-side `const msg = String(e)` used
    // for classification (never returned) is legitimate.
    if (/(?:error|message)\s*:\s*(?:"[^"]*"\s*\+\s*)?String\((?:e|err|error)\b/.test(stripped)) {
      offenders.push(`${path.relative(apiRoot, file)}: String(err) in payload`);
    }
  }
  assert.deepEqual(offenders, [], offenders.join("\n"));
});
