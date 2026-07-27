import "server-only";

import { resolveConnectedChannels } from "@/lib/channel-fit";
import { prisma } from "@/lib/db";

/**
 * Which channels this account can actually publish to, read from stored
 * credentials. Single source of truth so no screen invents its own list.
 *
 * Secrets are never returned or even loaded as values worth keeping: only the
 * presence of `zaloToken` reaches the pure resolver, because the column is
 * encrypted at rest and must not travel to a client component.
 */
export async function getConnectedChannels(facebookPageId: string): Promise<string[]> {
  const [page, settings, activeTiktokAccounts] = await Promise.all([
    prisma.facebookPage.findUnique({ where: { id: facebookPageId }, select: { igAccountId: true } }),
    prisma.settings.findUnique({ where: { id: "1" }, select: { zaloToken: true, zaloOaId: true } }),
    prisma.tikTokAccount.count({ where: { isActive: true } }),
  ]);

  return resolveConnectedChannels({
    hasFacebookPage: !!page,
    hasInstagramAccount: !!page?.igAccountId,
    hasZaloToken: !!settings?.zaloToken,
    hasZaloOaId: !!settings?.zaloOaId,
    activeTiktokAccounts,
  });
}
