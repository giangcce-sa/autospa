import { z } from "zod";

export interface AdsOptimizationSettings {
  adsOptimizePauseCtr: number;
  adsOptimizeScaleCtr: number;
  adsOptimizeFreqLimit: number;
  adsOptimizeScalePct: number;
  adsOptimizeMinSpend: number;
  adsOptimizeMaxBudget: number;
  adsOptimizeCooldownHrs: number;
  adsOptimizeMinRoas: number;
}

export const ADS_SETTINGS_DEFAULTS: AdsOptimizationSettings = {
  adsOptimizePauseCtr: 0.5,
  adsOptimizeScaleCtr: 2,
  adsOptimizeFreqLimit: 3,
  adsOptimizeScalePct: 20,
  adsOptimizeMinSpend: 100_000,
  adsOptimizeMaxBudget: 2_000_000,
  adsOptimizeCooldownHrs: 24,
  adsOptimizeMinRoas: 1.5,
};

const adsSettingsSchema = z.object({
  adsOptimizePauseCtr: z.number().finite().min(0.1).max(10).optional(),
  adsOptimizeScaleCtr: z.number().finite().min(0.2).max(20).optional(),
  adsOptimizeFreqLimit: z.number().finite().min(1).max(10).optional(),
  adsOptimizeScalePct: z.number().int().min(5).max(50).optional(),
  adsOptimizeMinSpend: z.number().int().min(50_000).max(100_000_000).optional(),
  adsOptimizeMaxBudget: z.number().int().min(100_000).max(1_000_000_000).optional(),
  adsOptimizeCooldownHrs: z.number().int().min(4).max(168).optional(),
  adsOptimizeMinRoas: z.number().finite().min(0.5).max(20).optional(),
});

const canonicalAdsSettingsSchema = adsSettingsSchema.strict();

export type AdsSettingsPatch = z.infer<typeof adsSettingsSchema>;

export interface AdsSettingsDto extends AdsOptimizationSettings {
  requestedAutomationLevel: "supervised" | "semi" | "full";
  effectiveAutomationLevel: "supervised" | "semi" | "full";
  executionMode: "read_only" | "supervised_manual" | "semi" | "full";
  emergencyStop: boolean;
  forcedDryRun: boolean;
  allowedFacebookPageIds: string[];
  allowedAdAccountIds: string[];
  currency: "VND";
}

export function parseAdsSettingsPatch(input: unknown): AdsSettingsPatch {
  return adsSettingsSchema.parse(input && typeof input === "object" ? input : {});
}

export function parseCanonicalAdsSettingsRequest(input: unknown): AdsSettingsPatch {
  const patch = canonicalAdsSettingsSchema.parse(input);
  if (!Object.keys(patch).length) {
    throw new z.ZodError([{ code: "custom", path: [], message: "Không có cấu hình quảng cáo để cập nhật" }]);
  }
  return patch;
}

export function toAdsOptimizationSettings(settings: Partial<AdsOptimizationSettings> | null | undefined): AdsOptimizationSettings {
  return {
    adsOptimizePauseCtr: settings?.adsOptimizePauseCtr ?? ADS_SETTINGS_DEFAULTS.adsOptimizePauseCtr,
    adsOptimizeScaleCtr: settings?.adsOptimizeScaleCtr ?? ADS_SETTINGS_DEFAULTS.adsOptimizeScaleCtr,
    adsOptimizeFreqLimit: settings?.adsOptimizeFreqLimit ?? ADS_SETTINGS_DEFAULTS.adsOptimizeFreqLimit,
    adsOptimizeScalePct: settings?.adsOptimizeScalePct ?? ADS_SETTINGS_DEFAULTS.adsOptimizeScalePct,
    adsOptimizeMinSpend: settings?.adsOptimizeMinSpend ?? ADS_SETTINGS_DEFAULTS.adsOptimizeMinSpend,
    adsOptimizeMaxBudget: settings?.adsOptimizeMaxBudget ?? ADS_SETTINGS_DEFAULTS.adsOptimizeMaxBudget,
    adsOptimizeCooldownHrs: settings?.adsOptimizeCooldownHrs ?? ADS_SETTINGS_DEFAULTS.adsOptimizeCooldownHrs,
    adsOptimizeMinRoas: settings?.adsOptimizeMinRoas ?? ADS_SETTINGS_DEFAULTS.adsOptimizeMinRoas,
  };
}

export function assertAdsThresholdOrder(settings: Pick<AdsOptimizationSettings, "adsOptimizePauseCtr" | "adsOptimizeScaleCtr">) {
  if (settings.adsOptimizePauseCtr >= settings.adsOptimizeScaleCtr) {
    throw new z.ZodError([{ code: "custom", path: ["adsOptimizePauseCtr"], message: "Ngưỡng pause phải thấp hơn ngưỡng scale" }]);
  }
}
