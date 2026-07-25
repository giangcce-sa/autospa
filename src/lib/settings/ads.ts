import "server-only";

import { prisma } from "@/lib/db";
import {
  getAdsExecutionMode,
  getEffectiveAdsAutomationLevel,
  shouldForceAdsDryRun,
} from "@/lib/ads-safety";
import { persistSettingsPatch } from "@/lib/settings/persistence";
import {
  assertAdsThresholdOrder,
  parseCanonicalAdsSettingsRequest,
  toAdsOptimizationSettings,
  type AdsSettingsDto,
} from "@/lib/settings/ads-policy";

const adsSettingsSelect = {
  automationLevel: true,
  adsOptimizePauseCtr: true,
  adsOptimizeScaleCtr: true,
  adsOptimizeFreqLimit: true,
  adsOptimizeScalePct: true,
  adsOptimizeMinSpend: true,
  adsOptimizeMaxBudget: true,
  adsOptimizeCooldownHrs: true,
  adsOptimizeMinRoas: true,
} as const;

function parseAllowlist(value: string | undefined) {
  return [...new Set((value ?? "").split(",").map((item) => item.trim()).filter(Boolean))];
}

function requestedLevel(value: string | null | undefined): AdsSettingsDto["requestedAutomationLevel"] {
  return value === "semi" || value === "full" ? value : "supervised";
}

function toAdsSettingsDto(settings: Awaited<ReturnType<typeof getStoredAdsSettings>>): AdsSettingsDto {
  const requestedAutomationLevel = requestedLevel(settings?.automationLevel);
  return {
    ...toAdsOptimizationSettings(settings),
    requestedAutomationLevel,
    effectiveAutomationLevel: getEffectiveAdsAutomationLevel(requestedAutomationLevel),
    executionMode: getAdsExecutionMode(),
    emergencyStop: process.env.ADS_EMERGENCY_STOP !== "false",
    forcedDryRun: shouldForceAdsDryRun(),
    allowedFacebookPageIds: parseAllowlist(process.env.ADS_ALLOWED_FACEBOOK_PAGE_IDS),
    allowedAdAccountIds: parseAllowlist(process.env.ADS_ALLOWED_AD_ACCOUNT_IDS),
    currency: "VND",
  };
}

async function getStoredAdsSettings() {
  return prisma.settings.findUnique({ where: { id: "1" }, select: adsSettingsSelect });
}

export async function getAdsSettings() {
  return toAdsSettingsDto(await getStoredAdsSettings());
}

export async function saveAdsSettings(
  input: unknown,
  audit: { userId: string; href: string; source: string },
) {
  const patch = parseCanonicalAdsSettingsRequest(input);
  const current = await getStoredAdsSettings();
  const effective = toAdsOptimizationSettings({ ...current, ...patch });
  assertAdsThresholdOrder(effective);
  const settings = await persistSettingsPatch(patch, audit);
  return toAdsSettingsDto(settings);
}
