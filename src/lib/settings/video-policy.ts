import { z } from "zod";
import { getSecretReplacement } from "../settings-secrets.ts";
import { resolveVideoExecutionPolicy, type VideoExecutionPolicy } from "../video-studio/execution-policy.ts";

export const VIDEO_SETTINGS_DEFAULTS = {
  runwayBaseUrl: "https://api.dev.runwayml.com",
  runwayVideoModel: "gen4.5",
  elevenLabsBaseUrl: "https://api.elevenlabs.io",
  elevenLabsVoiceModel: "eleven_multilingual_v2",
  syncLabsBaseUrl: "https://api.sync.so",
  syncLabsModel: "sync-3",
  videoMockMode: true,
  videoBudgetUsd: 25,
} as const;

export type VideoProviderId = "runway" | "elevenLabs" | "sync";
export type VideoSecretSource = "database" | "deployment" | "unconfigured";

export interface VideoSettingsDto {
  runwayBaseUrl: string;
  runwayVideoModel: string;
  hasRunwayApiKey: boolean;
  runwayKeySource: VideoSecretSource;
  elevenLabsBaseUrl: string;
  elevenLabsVoiceModel: string;
  hasElevenLabsApiKey: boolean;
  elevenLabsKeySource: VideoSecretSource;
  syncLabsBaseUrl: string;
  syncLabsModel: string;
  hasSyncLabsApiKey: boolean;
  syncLabsKeySource: VideoSecretSource;
  videoMockMode: boolean;
  executionPolicy: VideoExecutionPolicy;
  videoBudgetUsd: number;
}

export interface VideoSettingsDeployment {
  runwayApiKey?: string;
  runwayBaseUrl?: string;
  runwayVideoModel?: string;
  elevenLabsApiKey?: string;
  elevenLabsBaseUrl?: string;
  elevenLabsVoiceModel?: string;
  syncLabsApiKey?: string;
  syncLabsBaseUrl?: string;
  syncLabsModel?: string;
  videoMockMode?: boolean;
  videoExecutionMode?: string;
  videoEmergencyStop?: string;
  videoBudgetUsd?: number;
}

export type VideoSettingsRecord = {
  runwayApiKey?: string | null;
  runwayBaseUrl?: string | null;
  runwayVideoModel?: string | null;
  elevenLabsApiKey?: string | null;
  elevenLabsBaseUrl?: string | null;
  elevenLabsVoiceModel?: string | null;
  syncLabsApiKey?: string | null;
  syncLabsBaseUrl?: string | null;
  syncLabsModel?: string | null;
  videoMockMode?: boolean | null;
  videoBudgetUsd?: number | null;
};

const secret = z.string().trim().max(2000).optional();
const url = z.string().trim().max(2048).url().refine((value) => new URL(value).protocol === "https:", {
  message: "Địa chỉ dịch vụ video bắt buộc dùng HTTPS",
});
const model = z.string().trim().min(1).max(100);

const videoSettingsSchema = z.object({
  runwayApiKey: secret,
  runwayBaseUrl: url.optional(),
  runwayVideoModel: model.optional(),
  elevenLabsApiKey: secret,
  elevenLabsBaseUrl: url.optional(),
  elevenLabsVoiceModel: model.optional(),
  syncLabsApiKey: secret,
  syncLabsBaseUrl: url.optional(),
  syncLabsModel: model.optional(),
  videoMockMode: z.boolean().optional(),
  videoBudgetUsd: z.number().finite().min(1).max(10_000).optional(),
});

const canonicalVideoSettingsSchema = videoSettingsSchema.strict();

const videoProviderTestSchema = z.object({
  provider: z.enum(["runway", "elevenLabs", "sync"]),
  apiKey: secret,
  baseUrl: url.optional(),
}).strict();

function normalizePatch(value: z.infer<typeof videoSettingsSchema>) {
  const {
    runwayApiKey,
    elevenLabsApiKey,
    syncLabsApiKey,
    ...fields
  } = value;
  const runwayReplacement = getSecretReplacement(runwayApiKey);
  const elevenLabsReplacement = getSecretReplacement(elevenLabsApiKey);
  const syncReplacement = getSecretReplacement(syncLabsApiKey);

  return {
    ...fields,
    ...(runwayReplacement ? { runwayApiKey: runwayReplacement } : {}),
    ...(elevenLabsReplacement ? { elevenLabsApiKey: elevenLabsReplacement } : {}),
    ...(syncReplacement ? { syncLabsApiKey: syncReplacement } : {}),
  };
}

export type VideoSettingsPatch = ReturnType<typeof normalizePatch>;

export function parseVideoSettingsPatch(input: unknown) {
  return normalizePatch(videoSettingsSchema.parse(input && typeof input === "object" ? input : {}));
}

export function parseCanonicalVideoSettingsRequest(input: unknown) {
  const patch = normalizePatch(canonicalVideoSettingsSchema.parse(input));
  if (!Object.keys(patch).length) {
    throw new z.ZodError([{ code: "custom", path: [], message: "Không có cấu hình video để cập nhật" }]);
  }
  return patch;
}

export function parseVideoProviderTestRequest(input: unknown) {
  return videoProviderTestSchema.parse(input);
}

function source(databaseValue: string | null | undefined, deploymentValue: string | undefined): VideoSecretSource {
  return databaseValue ? "database" : deploymentValue ? "deployment" : "unconfigured";
}

export function toVideoSettingsDto(
  settings: VideoSettingsRecord | null | undefined,
  deployment: VideoSettingsDeployment = {},
): VideoSettingsDto {
  const requestedMockMode = settings?.videoMockMode ?? deployment.videoMockMode ?? VIDEO_SETTINGS_DEFAULTS.videoMockMode;
  const executionPolicy = resolveVideoExecutionPolicy({
    requestedMockMode,
    deploymentMode: deployment.videoExecutionMode,
    emergencyStop: deployment.videoEmergencyStop,
  });
  return {
    runwayBaseUrl: settings?.runwayBaseUrl || deployment.runwayBaseUrl || VIDEO_SETTINGS_DEFAULTS.runwayBaseUrl,
    runwayVideoModel: settings?.runwayVideoModel || deployment.runwayVideoModel || VIDEO_SETTINGS_DEFAULTS.runwayVideoModel,
    hasRunwayApiKey: Boolean(settings?.runwayApiKey || deployment.runwayApiKey),
    runwayKeySource: source(settings?.runwayApiKey, deployment.runwayApiKey),
    elevenLabsBaseUrl: settings?.elevenLabsBaseUrl || deployment.elevenLabsBaseUrl || VIDEO_SETTINGS_DEFAULTS.elevenLabsBaseUrl,
    elevenLabsVoiceModel: settings?.elevenLabsVoiceModel || deployment.elevenLabsVoiceModel || VIDEO_SETTINGS_DEFAULTS.elevenLabsVoiceModel,
    hasElevenLabsApiKey: Boolean(settings?.elevenLabsApiKey || deployment.elevenLabsApiKey),
    elevenLabsKeySource: source(settings?.elevenLabsApiKey, deployment.elevenLabsApiKey),
    syncLabsBaseUrl: settings?.syncLabsBaseUrl || deployment.syncLabsBaseUrl || VIDEO_SETTINGS_DEFAULTS.syncLabsBaseUrl,
    syncLabsModel: settings?.syncLabsModel || deployment.syncLabsModel || VIDEO_SETTINGS_DEFAULTS.syncLabsModel,
    hasSyncLabsApiKey: Boolean(settings?.syncLabsApiKey || deployment.syncLabsApiKey),
    syncLabsKeySource: source(settings?.syncLabsApiKey, deployment.syncLabsApiKey),
    videoMockMode: executionPolicy.mockMode,
    executionPolicy,
    videoBudgetUsd: settings?.videoBudgetUsd ?? deployment.videoBudgetUsd ?? VIDEO_SETTINGS_DEFAULTS.videoBudgetUsd,
  };
}
