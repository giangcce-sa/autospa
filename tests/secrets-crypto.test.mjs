import test from "node:test";
import assert from "node:assert/strict";
import { createCipheriv, createHash, randomBytes } from "node:crypto";

import { decryptSecret, encryptSecret, isEncryptedSecret } from "../src/lib/secrets-crypto.ts";

const AUTH_ONLY = { AUTH_SECRET: "auth-secret-for-tests" };
const WITH_KEY = { SECRETS_ENCRYPTION_KEY: "dedicated-key", AUTH_SECRET: "auth-secret-for-tests" };
const ROTATED = { SECRETS_ENCRYPTION_KEY: "new-key", AUTH_SECRET: "auth-secret-for-tests" };

function legacyV1Blob(value, secret) {
  // Same layout the old video-studio encryptVideoSecret produced.
  const key = createHash("sha256").update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["enc:v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(":");
}

test("v2 round-trip with AUTH_SECRET fallback key", () => {
  const blob = encryptSecret("sk-ant-abc123", AUTH_ONLY);
  assert.ok(blob.startsWith("enc:v2:"));
  assert.equal(decryptSecret(blob, AUTH_ONLY), "sk-ant-abc123");
});

test("encrypt is idempotent on already-encrypted values (v1 and v2)", () => {
  const v2 = encryptSecret("secret", AUTH_ONLY);
  assert.equal(encryptSecret(v2, AUTH_ONLY), v2);
  const v1 = legacyV1Blob("secret", AUTH_ONLY.AUTH_SECRET);
  assert.equal(encryptSecret(v1, AUTH_ONLY), v1);
});

test("plaintext and empty values pass through", () => {
  assert.equal(decryptSecret("plain-api-key", AUTH_ONLY), "plain-api-key");
  assert.equal(decryptSecret("", AUTH_ONLY), undefined);
  assert.equal(decryptSecret(null, AUTH_ONLY), undefined);
  assert.equal(decryptSecret(undefined, AUTH_ONLY), undefined);
  assert.equal(encryptSecret("", AUTH_ONLY), "");
});

test("legacy enc:v1 blobs (AUTH_SECRET-derived) still decrypt", () => {
  const v1 = legacyV1Blob("runway-key-9", AUTH_ONLY.AUTH_SECRET);
  assert.equal(decryptSecret(v1, AUTH_ONLY), "runway-key-9");
  assert.equal(decryptSecret(v1, WITH_KEY), "runway-key-9", "fallback chain must reach AUTH_SECRET");
});

test("SECRETS_ENCRYPTION_KEY takes priority for new writes; old blobs stay readable", () => {
  const oldBlob = encryptSecret("token-x", AUTH_ONLY);
  const newBlob = encryptSecret("token-x", WITH_KEY);
  assert.equal(decryptSecret(oldBlob, WITH_KEY), "token-x", "AUTH_SECRET-era blob readable after key added");
  assert.equal(decryptSecret(newBlob, WITH_KEY), "token-x");
  assert.equal(decryptSecret(newBlob, AUTH_ONLY), undefined, "dedicated-key blob must not decrypt without it");
});

test("rotation: AUTH_SECRET fallback keeps pre-rotation blobs readable", () => {
  const blob = encryptSecret("val", AUTH_ONLY);
  assert.equal(decryptSecret(blob, ROTATED), "val");
});

test("tampered or unreadable blobs return undefined, never throw", () => {
  const blob = encryptSecret("secret", AUTH_ONLY);
  const parts = blob.split(":");
  parts[4] = Buffer.from("tampered-cipher").toString("base64url");
  assert.equal(decryptSecret(parts.join(":"), AUTH_ONLY), undefined);
  assert.equal(decryptSecret("enc:v2:not-a-real-blob", AUTH_ONLY), undefined);
  assert.equal(decryptSecret(blob, {}), undefined);
});

test("encrypt without any key throws; isEncryptedSecret detects prefixes", () => {
  assert.throws(() => encryptSecret("x", {}));
  assert.equal(isEncryptedSecret("enc:v1:a:b:c"), true);
  assert.equal(isEncryptedSecret("enc:v2:a:b:c"), true);
  assert.equal(isEncryptedSecret("sk-plain"), false);
  assert.equal(isEncryptedSecret(null), false);
});
