import { z } from "zod";
import { getSecretReplacement } from "../settings-secrets.ts";

const boundedUrl = z.string().trim().min(1).max(2048);
const secret = z.string().trim().max(1000).optional();

const connectionSettingsSchema = z.object({
  spaApiUrl: z.union([boundedUrl, z.literal("")]).optional(),
  spaApiKey: secret,
  spaWebhookSecret: secret,
});
const canonicalConnectionSettingsSchema = connectionSettingsSchema.strict();
const connectionTestSchema = z.object({
  spaApiUrl: boundedUrl.optional(),
  spaApiKey: secret,
}).strict();

export interface ConnectionSettingsPatch {
  spaApiUrl?: string | null;
  spaApiKey?: string;
  spaWebhookSecret?: string;
}

export interface ConnectionSettingsDto {
  spaApiUrl: string;
  hasSpaApiKey: boolean;
  hasSpaWebhookSecret: boolean;
}

function normalizePatch(value: z.infer<typeof connectionSettingsSchema>): ConnectionSettingsPatch {
  const { spaApiUrl, spaApiKey, spaWebhookSecret } = value;
  const apiKeyReplacement = getSecretReplacement(spaApiKey);
  const webhookSecretReplacement = getSecretReplacement(spaWebhookSecret);
  return {
    ...(spaApiUrl !== undefined ? { spaApiUrl: spaApiUrl || null } : {}),
    ...(apiKeyReplacement ? { spaApiKey: apiKeyReplacement } : {}),
    ...(webhookSecretReplacement ? { spaWebhookSecret: webhookSecretReplacement } : {}),
  };
}

export function parseConnectionSettingsPatch(input: unknown): ConnectionSettingsPatch {
  const value = input && typeof input === "object" ? input : {};
  return normalizePatch(connectionSettingsSchema.parse(value));
}

export function parseCanonicalConnectionSettingsRequest(input: unknown): ConnectionSettingsPatch {
  const patch = normalizePatch(canonicalConnectionSettingsSchema.parse(input));
  if (!Object.keys(patch).length) {
    throw new z.ZodError([{ code: "custom", path: [], message: "Không có cấu hình kết nối để cập nhật" }]);
  }
  return patch;
}

export function parseConnectionTestRequest(input: unknown) {
  return connectionTestSchema.parse(input);
}

export function toConnectionSettingsDto(settings: {
  spaApiUrl?: string | null;
  spaApiKey?: string | null;
  spaWebhookSecret?: string | null;
} | null | undefined): ConnectionSettingsDto {
  return {
    spaApiUrl: settings?.spaApiUrl ?? "",
    hasSpaApiKey: Boolean(settings?.spaApiKey),
    hasSpaWebhookSecret: Boolean(settings?.spaWebhookSecret),
  };
}
