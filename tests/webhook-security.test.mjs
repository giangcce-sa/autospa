import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { secureCompare, verifyWebhookSignature } from "../src/lib/webhook-security.ts";

test("secureCompare: equal, unequal, length mismatch, empty", () => {
  assert.equal(secureCompare("verify-token-1", "verify-token-1"), true);
  assert.equal(secureCompare("verify-token-1", "verify-token-2"), false);
  assert.equal(secureCompare("short", "much-longer-value"), false);
  assert.equal(secureCompare("", ""), true);
  assert.equal(secureCompare("x", ""), false);
});

const rawBody = Buffer.from('{"object":"page","entry":[]}');
const secret = "test-app-secret";
const signature = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;

test("accepts a valid HMAC-SHA256 webhook signature", () => {
  assert.deepEqual(
    verifyWebhookSignature({ rawBody, signature, secret, env: { NODE_ENV: "production" } }),
    { allowed: true, reason: "verified" },
  );
});

test("rejects missing, malformed, and incorrect signatures", () => {
  for (const candidate of [null, "sha256=invalid", `sha256=${"0".repeat(64)}`]) {
    const decision = verifyWebhookSignature({
      rawBody,
      signature: candidate,
      secret,
      env: { NODE_ENV: "production" },
    });
    assert.equal(decision.allowed, false);
    assert.equal(decision.reason, "invalid_signature");
  }
});

test("fails closed when the webhook secret is missing", () => {
  for (const env of [
    { NODE_ENV: "production" },
    { NODE_ENV: "development" },
    { NODE_ENV: "production", ALLOW_INSECURE_DEV_WEBHOOKS: "true" },
  ]) {
    const decision = verifyWebhookSignature({ rawBody, signature: null, secret: undefined, env });
    assert.equal(decision.allowed, false);
    assert.equal(decision.reason, "missing_secret");
  }
});

test("allows an explicit unsigned webhook bypass only outside production", () => {
  assert.deepEqual(
    verifyWebhookSignature({
      rawBody,
      signature: null,
      secret: undefined,
      env: { NODE_ENV: "development", ALLOW_INSECURE_DEV_WEBHOOKS: "true" },
    }),
    { allowed: true, reason: "development_bypass" },
  );
});
