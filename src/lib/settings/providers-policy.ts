import { z } from "zod";
import { getSecretReplacement } from "../settings-secrets.ts";

export const PROVIDER_SETTINGS_DEFAULTS = {
  claudeBaseUrl: "https://api.anthropic.com",
  openaiBaseUrl: "https://api.openai.com/v1",
  openaiChatModel: "gpt-5",
  imageModel: "dall-e-3",
} as const;

const boundedString = (max: number) => z.string().trim().min(1).max(max);

const providerPatchSchema = z.object({
  claudeApiKey: z.string().trim().max(1000).optional(),
  claudeBaseUrl: boundedString(2048).optional(),
  openaiApiKey: z.string().trim().max(1000).optional(),
  openaiBaseUrl: boundedString(2048).optional(),
  openaiChatModel: boundedString(200).optional(),
});
const canonicalProviderPatchSchema = providerPatchSchema.strict();

const imagePatchSchema = z.object({ imageModel: boundedString(200).optional() });
const canonicalImagePatchSchema = imagePatchSchema.strict();

const providerTestSchema = z.object({
  provider: z.enum(["claude", "openai"]),
  apiKey: z.string().trim().max(1000).optional(),
  baseUrl: boundedString(2048).optional(),
  chatModel: boundedString(200).optional(),
}).strict();

export type ProviderSettingsPatch = {
  claudeApiKey?: string;
  claudeBaseUrl?: string;
  openaiApiKey?: string;
  openaiBaseUrl?: string;
  openaiChatModel?: string;
};

export interface ProviderSettingsDto {
  claudeBaseUrl: string;
  openaiBaseUrl: string;
  openaiChatModel: string;
  hasClaudeApiKey: boolean;
  hasOpenaiApiKey: boolean;
}

export interface ImageSettingsDto {
  imageModel: string;
  storage: {
    provider: "local" | "s3";
    configured: boolean;
    source: "deployment";
  };
}

function normalizedProviderPatch(value: z.infer<typeof providerPatchSchema>) {
  const { claudeApiKey, openaiApiKey, ...fields } = value;
  const claudeReplacement = getSecretReplacement(claudeApiKey);
  const openaiReplacement = getSecretReplacement(openaiApiKey);
  return {
    ...fields,
    ...(claudeReplacement ? { claudeApiKey: claudeReplacement } : {}),
    ...(openaiReplacement ? { openaiApiKey: openaiReplacement } : {}),
  };
}

export function parseProviderSettingsPatch(input: unknown): ProviderSettingsPatch {
  const value = input && typeof input === "object" ? input : {};
  return normalizedProviderPatch(providerPatchSchema.parse(value));
}

export function parseCanonicalProviderSettingsRequest(input: unknown): ProviderSettingsPatch {
  const patch = normalizedProviderPatch(canonicalProviderPatchSchema.parse(input));
  if (!Object.keys(patch).length) {
    throw new z.ZodError([{ code: "custom", path: [], message: "Không có cấu hình provider để cập nhật" }]);
  }
  return patch;
}

export function parseImageSettingsPatch(input: unknown) {
  const value = input && typeof input === "object" ? input : {};
  return imagePatchSchema.parse(value);
}

export function parseCanonicalImageSettingsRequest(input: unknown) {
  const patch = canonicalImagePatchSchema.parse(input);
  if (!Object.keys(patch).length) {
    throw new z.ZodError([{ code: "custom", path: [], message: "Không có cấu hình hình ảnh để cập nhật" }]);
  }
  return patch;
}

export function parseProviderTestRequest(input: unknown) {
  return providerTestSchema.parse(input);
}

export function toProviderSettingsDto(settings: {
  claudeApiKey?: string | null;
  claudeBaseUrl?: string | null;
  openaiApiKey?: string | null;
  openaiBaseUrl?: string | null;
  openaiChatModel?: string | null;
} | null | undefined): ProviderSettingsDto {
  return {
    claudeBaseUrl: settings?.claudeBaseUrl ?? PROVIDER_SETTINGS_DEFAULTS.claudeBaseUrl,
    openaiBaseUrl: settings?.openaiBaseUrl ?? PROVIDER_SETTINGS_DEFAULTS.openaiBaseUrl,
    openaiChatModel: settings?.openaiChatModel ?? PROVIDER_SETTINGS_DEFAULTS.openaiChatModel,
    hasClaudeApiKey: Boolean(settings?.claudeApiKey),
    hasOpenaiApiKey: Boolean(settings?.openaiApiKey),
  };
}

export function toImageSettingsDto(settings: { imageModel?: string | null } | null | undefined): ImageSettingsDto {
  const provider = process.env.MEDIA_STORAGE_PROVIDER === "s3" ? "s3" : "local";
  return {
    imageModel: settings?.imageModel ?? PROVIDER_SETTINGS_DEFAULTS.imageModel,
    storage: {
      provider,
      configured: provider === "local" || Boolean(process.env.MEDIA_S3_BUCKET),
      source: "deployment",
    },
  };
}
