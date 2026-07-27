// Pure policy for login/bootstrap brute-force limiting — no prisma, importable from tests.
// Only FAILED attempts are counted (see auth.ts); successful logins reset the email bucket,
// so e2e suites and normal usage never trip these limits.

export const LOGIN_FAIL_LIMIT = 10;
export const LOGIN_WINDOW_SEC = 15 * 60;
export const LOGIN_IP_FAIL_LIMIT = 30;
export const LOGIN_IP_WINDOW_SEC = 15 * 60;
export const BOOTSTRAP_IP_LIMIT = 5;
export const BOOTSTRAP_WINDOW_SEC = 60 * 60;

export function normalizeLoginEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function loginEmailKey(email: string): string {
  return `login:email:${normalizeLoginEmail(email)}`;
}

export function loginIpKey(ip: string | null): string {
  return `login:ip:${ip || "unknown"}`;
}

export function bootstrapIpKey(ip: string | null): string {
  return `bootstrap:ip:${ip || "unknown"}`;
}

/** First hop of an x-forwarded-for header, or null when absent/blank. */
export function firstForwardedIp(headerValue: string | null | undefined): string | null {
  if (!headerValue) return null;
  const first = headerValue.split(",")[0]?.trim();
  return first || null;
}

/** A bucket blocks the login when its window is active and the fail budget is spent. */
export function isLockedOut(quota: { remaining: number; windowEndsIn: number } | null): boolean {
  return !!quota && quota.remaining <= 0 && quota.windowEndsIn > 0;
}
