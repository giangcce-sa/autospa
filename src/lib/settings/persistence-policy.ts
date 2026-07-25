export interface SettingsAuditContext {
  userId: string;
  href: string;
  source: string;
  title?: string;
}

export function settingsAuditInput(fields: string[], audit: SettingsAuditContext) {
  return {
    type: "settings_change",
    title: audit.title ?? "Đã cập nhật cấu hình hệ thống",
    detail: `Thay đổi ${fields.length} trường cấu hình`,
    href: audit.href,
    severity: "info" as const,
    source: audit.source,
    metadata: {
      userId: audit.userId,
      fields: fields.filter((key) => !/(key|secret|token)/i.test(key)),
    },
  };
}

export async function writeSettingsPatch<Patch extends object, Result>(
  patch: Patch,
  audit: SettingsAuditContext,
  dependencies: {
    write: (patch: Patch) => Promise<Result>;
    audit: (input: ReturnType<typeof settingsAuditInput>) => Promise<unknown>;
  },
) {
  const settings = await dependencies.write(patch);
  await dependencies.audit(settingsAuditInput(Object.keys(patch), audit)).catch(() => null);
  return settings;
}
