// Shared at-rest encryption for DB-stored secrets — AES-256-GCM.
// Pure given env (no prisma, no server-only) so tests can import it.
//
// Format: enc:vN:<iv b64url>:<tag b64url>:<ciphertext b64url>  (12-byte IV)
//   enc:v1 — legacy video-studio blobs, key = sha256(AUTH_SECRET)
//   enc:v2 — key = sha256(SECRETS_ENCRYPTION_KEY ?? AUTH_SECRET)
// Decrypt tries every candidate key, so setting SECRETS_ENCRYPTION_KEY later
// (or rotating it) keeps old blobs readable while new writes use the new key.
// Plaintext values pass through decrypt untouched (lazy migration: rows encrypt
// on their next save or via scripts/encrypt-secrets.mjs).

import { createCipheriv, createDecipheriv, createHash } from "node:crypto";
import { randomBytes } from "node:crypto";

const PREFIX = "enc:v2";
const ANY_ENC_PREFIX = "enc:";

type CryptoEnv = { [key: string]: string | undefined };

function candidateKeys(env: CryptoEnv): Buffer[] {
  return [env.SECRETS_ENCRYPTION_KEY, env.AUTH_SECRET]
    .filter((secret): secret is string => !!secret)
    .map((secret) => createHash("sha256").update(secret).digest());
}

export function isEncryptedSecret(value: unknown): boolean {
  return typeof value === "string" && value.startsWith(ANY_ENC_PREFIX);
}

export function encryptSecret(value: string, env: CryptoEnv = process.env): string {
  if (value === "" || value.startsWith(ANY_ENC_PREFIX)) return value;
  const [key] = candidateKeys(env);
  if (!key) throw new Error("SECRETS_ENCRYPTION_KEY hoặc AUTH_SECRET chưa được cấu hình để mã hóa API key");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(":");
}

export function decryptSecret(value: string | null | undefined, env: CryptoEnv = process.env): string | undefined {
  if (!value) return undefined;
  if (!value.startsWith(ANY_ENC_PREFIX)) return value; // plaintext passthrough (lazy migration)

  const [, , ivValue, tagValue, encryptedValue] = value.split(":");
  if (!ivValue || !tagValue || !encryptedValue) {
    console.error("decryptSecret: malformed encrypted value");
    return undefined;
  }

  for (const key of candidateKeys(env)) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivValue, "base64url"));
      decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
      return Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8");
    } catch {
      // wrong/rotated key — try the next candidate
    }
  }

  console.error("decryptSecret: no configured key decrypts this value (rotated without fallback?)");
  return undefined;
}
