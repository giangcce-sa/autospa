import { createHash } from "node:crypto";

export function adsCreateRequestHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function assertAdsCreateRequestMatches(existingHash: string, requestHash: string) {
  if (existingHash !== requestHash) {
    throw new Error("Idempotency key đã được dùng cho yêu cầu khác");
  }
}
