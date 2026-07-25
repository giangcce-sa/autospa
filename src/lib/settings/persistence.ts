import "server-only";

import type { Prisma } from "@prisma/client";
import { logActivity } from "@/lib/activity-log";
import { prisma } from "@/lib/db";
import { writeSettingsPatch, type SettingsAuditContext } from "@/lib/settings/persistence-policy";

export type SettingsScalarPatch = Partial<Omit<Prisma.SettingsUncheckedCreateInput, "id" | "createdAt" | "updatedAt">>;

export type { SettingsAuditContext } from "@/lib/settings/persistence-policy";

export async function persistSettingsPatch(
  patch: SettingsScalarPatch,
  audit: SettingsAuditContext,
) {
  return writeSettingsPatch(patch, audit, {
    write: (data) => prisma.settings.upsert({
      where: { id: "1" },
      update: data,
      create: { id: "1", ...data },
    }),
    audit: logActivity,
  });
}
