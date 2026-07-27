import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API_ROOT = fileURLToPath(new URL("../src/app/api", import.meta.url));

// Routes that are public by design — every other route file must carry an auth marker.
const PUBLIC_BY_DESIGN = new Set([
  "health/route.ts",                 // liveness, static
  "ready/route.ts",                  // readiness probe
  "auth/[...nextauth]/route.ts",     // NextAuth handlers
  "auth/bootstrap/route.ts",         // self-gated (only when zero users) + IP rate limited
  "media-public/[...path]/route.ts", // HMAC-signed URL with expiry
]);

// Any of these appearing in the source counts as an auth guard.
const AUTH_MARKERS = [
  "requireUser(",
  "requirePageAccess(",
  "requireExplicitPageAccess(",
  "requireMediaAccess(",
  "verifyCronAuth(",
  "verifyWebhookSignature(",
  "verifySpaWebhook(",
  "verifyMediaSignature(",
  "secureEqual(",       // telegram webhook header compare (legacy name)
  "secureCompare(",     // shared timing-safe compare
  "isValidOAuthState(", // OAuth callbacks (redirect flow, session + role checked inline)
];

async function collectRouteFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await collectRouteFiles(full)));
    } else if (entry.name === "route.ts") {
      out.push(full);
    }
  }
  return out;
}

test("every API route is either authenticated or explicitly public by design", async () => {
  const files = await collectRouteFiles(API_ROOT);
  assert.ok(files.length >= 120, `expected the full route tree, found ${files.length}`);

  const missing = [];
  for (const file of files) {
    const rel = path.relative(API_ROOT, file).replaceAll("\\", "/");
    if (PUBLIC_BY_DESIGN.has(rel)) continue;
    const source = await readFile(file, "utf8");
    if (!AUTH_MARKERS.some((marker) => source.includes(marker))) {
      missing.push(rel);
    }
  }

  assert.deepEqual(missing, [], `routes without any auth guard: ${missing.join(", ")}`);
});

test("the public allowlist does not rot", async () => {
  for (const rel of PUBLIC_BY_DESIGN) {
    const source = await readFile(path.join(API_ROOT, rel), "utf8");
    assert.ok(source.length > 0, `${rel} vanished — update the allowlist`);
  }
  // bootstrap must keep its self-gating + rate limit to deserve the allowlist
  const bootstrap = await readFile(path.join(API_ROOT, "auth/bootstrap/route.ts"), "utf8");
  assert.match(bootstrap, /checkAndIncrement\(bootstrapIpKey/);
  assert.match(bootstrap, /isolationLevel: "Serializable"/);
  // media-public must keep signature verification
  const mediaPublic = await readFile(path.join(API_ROOT, "media-public/[...path]/route.ts"), "utf8");
  assert.match(mediaPublic, /verifyMediaSignature\(/);
});

test("high-risk formerly-open routes now enforce roles", async () => {
  const ownerOnly = ["feedback/route.ts", "intelligence/route.ts", "ads-creative/route.ts"];
  for (const rel of ownerOnly) {
    const source = await readFile(path.join(API_ROOT, rel), "utf8");
    assert.match(source, /requireUser\(\{ owner: true \}\)/, `${rel} must gate mutations behind owner`);
  }
  for (const rel of ["skin-ai/route.ts", "repurpose/route.ts"]) {
    const source = await readFile(path.join(API_ROOT, rel), "utf8");
    assert.match(source, /await requireUser\(\)/, `${rel} must require a session`);
  }
});
