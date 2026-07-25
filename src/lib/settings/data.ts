import "server-only";

import { prisma } from "@/lib/db";
import { toDataSettingsDto } from "@/lib/settings/data-policy";

export async function getDataSettings() {
  const settings = await prisma.settings.findUnique({
    where: { id: "1" },
    select: {
      draftRetentionDays: true,
      publishedRetentionDays: true,
    },
  });
  return toDataSettingsDto(settings);
}
