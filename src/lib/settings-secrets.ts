const MASK_CHARACTER = "•";
const MASK_LENGTH = 8;

export function isMaskedSecret(value: unknown) {
  return typeof value === "string" && value.includes(MASK_CHARACTER.repeat(2));
}

export function getSecretReplacement(value: unknown): string | undefined {
  if (typeof value !== "string" || isMaskedSecret(value)) return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

export function resolveSecretInput(value: unknown, storedValue: string | null | undefined) {
  return getSecretReplacement(value) ?? storedValue ?? null;
}

export function maskSecret(value: string | null | undefined, revealLast = 4) {
  if (!value) return null;
  const suffix = revealLast > 0 ? value.slice(-revealLast) : "";
  return MASK_CHARACTER.repeat(MASK_LENGTH) + suffix;
}
