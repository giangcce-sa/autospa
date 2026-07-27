// Pure path matcher for the auth proxy — no prisma, importable from tests.

/**
 * Segment-aware public-path check: "/setup" matches "/setup" and "/setup/x"
 * but NOT "/setup-admin" (loose startsWith would).
 */
export function matchesPublicPath(pathname: string, publicPaths: readonly string[]): boolean {
  return publicPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
