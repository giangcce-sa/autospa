import "server-only";

import { prisma } from "@/lib/db";
import { sameProviderOrigin } from "@/lib/provider-url-validation";
import { assertSafeProviderBaseUrl } from "@/lib/video-studio/media-security";
import { providerFetch } from "@/lib/video-studio/http";
import { decryptVideoSecret, encryptVideoSecret } from "@/lib/video-studio/secrets";
import { getSecretReplacement } from "@/lib/settings-secrets";
import { persistSettingsPatch } from "@/lib/settings/persistence";
import {
  parseCanonicalVideoSettingsRequest,
  parseVideoProviderTestRequest,
  parseVideoSettingsPatch,
  toVideoSettingsDto,
  VIDEO_SETTINGS_DEFAULTS,
  type VideoProviderId,
  type VideoSettingsDeployment,
  type VideoSettingsDto,
  type VideoSettingsPatch,
} from "@/lib/settings/video-policy";

const videoSettingsSelect = {
  runwayApiKey: true,
  runwayBaseUrl: true,
  runwayVideoModel: true,
  elevenLabsApiKey: true,
  elevenLabsBaseUrl: true,
  elevenLabsVoiceModel: true,
  syncLabsApiKey: true,
  syncLabsBaseUrl: true,
  syncLabsModel: true,
  videoMockMode: true,
  videoBudgetUsd: true,
} as const;

type VideoSettingsRecord = Awaited<ReturnType<typeof getStoredVideoSettings>>;

function deploymentSettings(): VideoSettingsDeployment {
  const budget = Number(process.env.VIDEO_BUDGET_USD);
  return {
    runwayApiKey: process.env.RUNWAY_API_KEY || process.env.RUNWAYML_API_SECRET,
    runwayBaseUrl: process.env.RUNWAY_BASE_URL,
    runwayVideoModel: process.env.RUNWAY_VIDEO_MODEL,
    elevenLabsApiKey: process.env.ELEVENLABS_API_KEY,
    elevenLabsBaseUrl: process.env.ELEVENLABS_BASE_URL,
    elevenLabsVoiceModel: process.env.ELEVENLABS_VOICE_MODEL,
    syncLabsApiKey: process.env.SYNC_API_KEY,
    syncLabsBaseUrl: process.env.SYNC_BASE_URL,
    syncLabsModel: process.env.SYNC_MODEL,
    videoMockMode: process.env.VIDEO_MOCK_MODE === undefined ? undefined : process.env.VIDEO_MOCK_MODE !== "false",
    videoExecutionMode: process.env.VIDEO_EXECUTION_MODE,
    videoEmergencyStop: process.env.VIDEO_EMERGENCY_STOP,
    videoBudgetUsd: Number.isFinite(budget) ? budget : undefined,
  };
}

async function getStoredVideoSettings() {
  return prisma.settings.findUnique({ where: { id: "1" }, select: videoSettingsSelect });
}

export async function getVideoSettings(): Promise<VideoSettingsDto> {
  return toVideoSettingsDto(await getStoredVideoSettings(), deploymentSettings());
}

function providerFields(provider: VideoProviderId) {
  if (provider === "runway") {
    return {
      key: "runwayApiKey" as const,
      base: "runwayBaseUrl" as const,
      defaultBase: VIDEO_SETTINGS_DEFAULTS.runwayBaseUrl,
      deploymentKey: deploymentSettings().runwayApiKey,
      deploymentBase: deploymentSettings().runwayBaseUrl,
      label: "Runway",
    };
  }
  if (provider === "elevenLabs") {
    return {
      key: "elevenLabsApiKey" as const,
      base: "elevenLabsBaseUrl" as const,
      defaultBase: VIDEO_SETTINGS_DEFAULTS.elevenLabsBaseUrl,
      deploymentKey: deploymentSettings().elevenLabsApiKey,
      deploymentBase: deploymentSettings().elevenLabsBaseUrl,
      label: "ElevenLabs",
    };
  }
  return {
    key: "syncLabsApiKey" as const,
    base: "syncLabsBaseUrl" as const,
    defaultBase: VIDEO_SETTINGS_DEFAULTS.syncLabsBaseUrl,
    deploymentKey: deploymentSettings().syncLabsApiKey,
    deploymentBase: deploymentSettings().syncLabsBaseUrl,
    label: "Sync Labs",
  };
}

async function validateVideoPatch(patch: VideoSettingsPatch, current: VideoSettingsRecord) {
  const update: VideoSettingsPatch = { ...patch };
  for (const provider of ["runway", "elevenLabs", "sync"] as const) {
    const fields = providerFields(provider);
    const requestedBase = patch[fields.base];
    const replacement = patch[fields.key];
    if (requestedBase) {
      const safeBase = await assertSafeProviderBaseUrl(provider, requestedBase);
      const currentBase = current?.[fields.base] || fields.deploymentBase || fields.defaultBase;
      const hasEffectiveKey = Boolean(current?.[fields.key] || fields.deploymentKey);
      if (hasEffectiveKey && !replacement && !sameProviderOrigin(safeBase, currentBase)) {
        throw new Error(`Khi đổi gateway ${fields.label}, bạn phải nhập lại khóa truy cập`);
      }
      update[fields.base] = safeBase;
    }
    if (replacement) update[fields.key] = encryptVideoSecret(replacement);
  }
  return update;
}

export async function saveVideoSettings(
  input: unknown,
  audit: { userId: string; href: string; source: string },
  options: { canonical?: boolean } = { canonical: true },
) {
  const patch = options.canonical === false
    ? parseVideoSettingsPatch(input)
    : parseCanonicalVideoSettingsRequest(input);
  if (!Object.keys(patch).length) return getVideoSettings();
  const update = await validateVideoPatch(patch, await getStoredVideoSettings());
  const settings = await persistSettingsPatch(update, audit);
  return toVideoSettingsDto(settings, deploymentSettings());
}

export async function testVideoProviderSettings(input: unknown) {
  const request = parseVideoProviderTestRequest(input);
  const current = await getStoredVideoSettings();
  const fields = providerFields(request.provider);
  const replacement = getSecretReplacement(request.apiKey);
  const currentBase = current?.[fields.base] || fields.deploymentBase || fields.defaultBase;
  const requestedBase = await assertSafeProviderBaseUrl(request.provider, request.baseUrl || currentBase);
  if (!replacement && !sameProviderOrigin(requestedBase, currentBase)) {
    throw new Error(`Khi đổi gateway ${fields.label}, bạn phải nhập lại khóa truy cập`);
  }
  const key = replacement || decryptVideoSecret(current?.[fields.key]) || fields.deploymentKey;
  if (!key) throw new Error(`Chưa cấu hình API key cho ${fields.label}`);

  if (request.provider === "runway") {
    await providerFetch(`${requestedBase}/v1/tasks?limit=1`, {
      headers: { Authorization: `Bearer ${key}`, "X-Runway-Version": "2024-11-06" },
    }, 30_000);
  } else if (request.provider === "elevenLabs") {
    await providerFetch(`${requestedBase}/v1/voices`, {
      headers: { "xi-api-key": key },
    }, 30_000);
  } else {
    await providerFetch(`${requestedBase}/v2/models`, {
      headers: { "x-api-key": key },
    }, 30_000);
  }

  return { success: true, message: "Kết nối thành công" };
}
