import assert from "node:assert/strict";
import test from "node:test";
import { redactSentryEvent } from "../src/lib/sentry-redaction.ts";

test("Sentry redaction removes request credentials and nested secret fields", () => {
  const event = redactSentryEvent({
    request: {
      data: { password: "secret" },
      cookies: { session: "secret" },
      headers: { authorization: "Bearer secret", accept: "application/json" },
    },
    extra: {
      provider: { apiKey: "secret", model: "safe" },
      attempts: [{ access_token: "secret", status: "failed" }],
    },
    contexts: { runtime: { privateKey: "secret", release: "sha-123" } },
  });

  assert.equal(event.request.data, "[redacted]");
  assert.equal(event.request.cookies, "[redacted]");
  assert.equal(event.request.headers.authorization, "[redacted]");
  assert.equal(event.request.headers.accept, "application/json");
  assert.equal(event.extra.provider.apiKey, "[redacted]");
  assert.equal(event.extra.provider.model, "safe");
  assert.equal(event.extra.attempts[0].access_token, "[redacted]");
  assert.equal(event.contexts.runtime.privateKey, "[redacted]");
  assert.equal(event.contexts.runtime.release, "sha-123");
});
