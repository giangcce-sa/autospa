import "server-only";

import type { Prisma } from "@prisma/client";
import { logActivity } from "@/lib/activity-log";
import { prisma } from "@/lib/db";
import { encryptSecret } from "@/lib/secrets-crypto";
import { encryptSettingsSecrets } from "@/lib/settings/secret-fields";
import { writeSettingsPatch, type SettingsAuditContext } from "@/lib/settings/persistence-policy";

export type SettingsScalarPatch = Partial<Omit<Prisma.SettingsUncheckedCreateInput, "id" | "createdAt" | "updatedAt">>;

export type { SettingsAuditContext } from "@/lib/settings/persistence-policy";

export async function persistSettingsPatch(
  patch: SettingsScalarPatch,
  audit: SettingsAuditContext,
) {
  return writeSettingsPatch(encryptSettingsSecrets(patch, (value) => encryptSecret(value)), audit, {
    write: (data) => prisma.settings.upsert({
      where: { id: "1" },
      update: data,
      create: { id: "1", ...data },
    }),
    audit: logActivity,
  });
}
