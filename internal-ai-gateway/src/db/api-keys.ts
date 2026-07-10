import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

export type GeneratedApiKey = {
  rawKey: string;
  prefix: string;
  hash: string;
};

function scryptOptions(): { N: number } | undefined {
  return process.env.VITEST || process.env.NODE_ENV === "test" ? { N: 1024 } : undefined;
}

// Format: $s2$<32-hex-salt>$<64-hex-hash>
function makeScryptHash(rawKey: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(`${env.KEY_PEPPER}:${rawKey}`, salt, 32, scryptOptions()).toString("hex");
  return `$s2$${salt}$${hash}`;
}

// Handles both legacy SHA256 and current scrypt hashes
export function verifyApiKeyHash(rawKey: string, stored: string): boolean {
  if (stored.startsWith("$s2$")) {
    const parts = stored.split("$");
    if (parts.length !== 4) return false;
    const [, , salt, expected] = parts;
    const actual = scryptSync(`${env.KEY_PEPPER}:${rawKey}`, salt, 32, scryptOptions()).toString("hex");
    const bufActual = Buffer.from(actual, "hex");
    const bufExpected = Buffer.from(expected, "hex");
    if (bufActual.length !== bufExpected.length) return false;
    return timingSafeEqual(bufActual, bufExpected);
  }
  // Legacy SHA256 — still verify safely
  const actual = createHash("sha256").update(`${env.KEY_PEPPER}:${rawKey}`).digest("hex");
  const bufActual = Buffer.from(actual, "hex");
  const bufStored = Buffer.from(stored, "hex");
  if (bufActual.length !== bufStored.length) return false;
  return timingSafeEqual(bufActual, bufStored);
}

export function isLegacyHash(stored: string): boolean {
  return !stored.startsWith("$s2$");
}

export function hashApiKey(rawKey: string): string {
  return makeScryptHash(rawKey);
}

export function parseApiKeyPrefix(rawKey: string): string | undefined {
  const parts = rawKey.split("_");
  if (parts.length < 4 || parts[0] !== "gw") {
    return undefined;
  }

  return parts[2];
}

export function generateApiKey(mode: "live" | "test" = "live"): GeneratedApiKey {
  const prefix = randomBytes(4).toString("hex");
  const secret = randomBytes(24).toString("base64url");
  const rawKey = `gw_${mode}_${prefix}_${secret}`;

  return {
    rawKey,
    prefix,
    hash: makeScryptHash(rawKey)
  };
}
