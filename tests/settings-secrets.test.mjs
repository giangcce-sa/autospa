import test from "node:test";
import assert from "node:assert/strict";
import {
  getSecretReplacement,
  isMaskedSecret,
  maskSecret,
  resolveSecretInput,
} from "../src/lib/settings-secrets.ts";

test("secret masks never become replacement values", () => {
  assert.equal(isMaskedSecret("••••••••1234"), true);
  assert.equal(getSecretReplacement("••••••••1234"), undefined);
  assert.equal(resolveSecretInput("••••••••1234", "stored-secret"), "stored-secret");
});

test("empty secret input preserves the stored value", () => {
  assert.equal(getSecretReplacement("   "), undefined);
  assert.equal(resolveSecretInput("", "stored-secret"), "stored-secret");
  assert.equal(resolveSecretInput(undefined, null), null);
});

test("fresh secret input is trimmed and replaces the stored value", () => {
  assert.equal(getSecretReplacement("  fresh-secret  "), "fresh-secret");
  assert.equal(resolveSecretInput("fresh-secret", "stored-secret"), "fresh-secret");
});

test("secret responses reveal only an optional suffix", () => {
  assert.equal(maskSecret("super-secret"), "••••••••cret");
  assert.equal(maskSecret("super-secret", 0), "••••••••");
  assert.equal(maskSecret(null), null);
});
