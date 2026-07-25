import { z } from "zod";

export const DATA_SETTINGS_DEFAULTS = {
  draftRetentionDays: 30,
  publishedRetentionDays: 90,
} as const;

const retentionDays = z.number().int().min(0).max(3650);
const dataSettingsSchema = z.object({
  draftRetentionDays: retentionDays.optional(),
  publishedRetentionDays: retentionDays.optional(),
});
const canonicalDataSettingsSchema = dataSettingsSchema.strict().refine(
  (value) => Object.keys(value).length > 0,
  { message: "Không có cấu hình dữ liệu để cập nhật" },
);

export interface DataSettingsDto {
  draftRetentionDays: number;
  publishedRetentionDays: number;
}

export type DataSettingsPatch = Partial<DataSettingsDto>;

export function parseDataSettingsPatch(input: unknown): DataSettingsPatch {
  const value = input && typeof input === "object" ? input : {};
  return dataSettingsSchema.parse(value);
}

export function parseCanonicalDataSettingsRequest(input: unknown): DataSettingsPatch {
  return canonicalDataSettingsSchema.parse(input);
}

export function toDataSettingsDto(settings: Partial<DataSettingsDto> | null | undefined): DataSettingsDto {
  return {
    draftRetentionDays: settings?.draftRetentionDays ?? DATA_SETTINGS_DEFAULTS.draftRetentionDays,
    publishedRetentionDays: settings?.publishedRetentionDays ?? DATA_SETTINGS_DEFAULTS.publishedRetentionDays,
  };
}
