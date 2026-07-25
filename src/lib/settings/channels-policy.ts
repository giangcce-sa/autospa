import { z } from "zod";
import { getSecretReplacement } from "../settings-secrets.ts";

const optionalSecret = z.string().trim().max(2000).optional();
const nullableString = (max: number) => z.string().trim().max(max).transform((value) => value || null).optional();

const zaloSettingsSchema = z.object({
  zaloToken: optionalSecret,
  zaloOaId: nullableString(200),
});

const canonicalZaloSettingsSchema = zaloSettingsSchema.strict();
const zaloTestSchema = z.object({ zaloToken: optionalSecret }).strict();

const telegramSettingsSchema = z.object({
  telegramBotToken: optionalSecret,
  telegramChatId: nullableString(200),
  telegramAdminUserId: nullableString(200),
  telegramAlerts: z.boolean().optional(),
  weeklyReportEnabled: z.boolean().optional(),
  weeklyReportDay: z.number().int().min(0).max(6).optional(),
  weeklyReportHour: z.number().int().min(0).max(23).optional(),
});

export interface ZaloSettingsDto {
  zaloOaId: string;
  hasZaloToken: boolean;
}

export interface TelegramSettingsDto {
  hasBotToken: boolean;
  telegramChatId: string;
  telegramAdminUserId: string;
  telegramAlerts: boolean;
  weeklyReportEnabled: boolean;
  weeklyReportDay: number;
  weeklyReportHour: number;
  webhookConfigured: boolean;
  webhookUrl: string | null;
  lastDelivery: {
    status: string;
    type: string;
    error: string | null;
    createdAt: string;
  } | null;
}

function normalizeZaloPatch(value: z.infer<typeof zaloSettingsSchema>) {
  const replacement = getSecretReplacement(value.zaloToken);
  return {
    ...(value.zaloOaId !== undefined ? { zaloOaId: value.zaloOaId } : {}),
    ...(replacement ? { zaloToken: replacement } : {}),
  };
}

export function parseZaloSettingsPatch(input: unknown) {
  const value = input && typeof input === "object" ? input : {};
  return normalizeZaloPatch(zaloSettingsSchema.parse(value));
}

export function parseCanonicalZaloSettingsRequest(input: unknown) {
  const patch = normalizeZaloPatch(canonicalZaloSettingsSchema.parse(input));
  if (!Object.keys(patch).length) {
    throw new z.ZodError([{ code: "custom", path: [], message: "Không có cấu hình Zalo để cập nhật" }]);
  }
  return patch;
}

export function parseZaloTestRequest(input: unknown) {
  return zaloTestSchema.parse(input);
}

export function parseTelegramSettingsPatch(input: unknown) {
  const value = telegramSettingsSchema.parse(input && typeof input === "object" ? input : {});
  const { telegramBotToken, ...fields } = value;
  const replacement = getSecretReplacement(telegramBotToken);
  const patch = {
    ...fields,
    ...(replacement ? { telegramBotToken: replacement } : {}),
  };
  if (!Object.keys(patch).length) {
    throw new z.ZodError([{ code: "custom", path: [], message: "Không có cấu hình Telegram để cập nhật" }]);
  }
  return patch;
}

export function toZaloSettingsDto(settings: {
  zaloToken?: string | null;
  zaloOaId?: string | null;
} | null | undefined): ZaloSettingsDto {
  return {
    zaloOaId: settings?.zaloOaId ?? "",
    hasZaloToken: Boolean(settings?.zaloToken),
  };
}

export function toTelegramSettingsDto(
  settings: {
    telegramBotToken?: string | null;
    telegramChatId?: string | null;
    telegramAdminUserId?: string | null;
    telegramAlerts?: boolean | null;
    weeklyReportEnabled?: boolean | null;
    weeklyReportDay?: number | null;
    weeklyReportHour?: number | null;
    telegramWebhookAt?: Date | null;
    telegramWebhookUrl?: string | null;
  } | null | undefined,
  lastDelivery: {
    status: string;
    type: string;
    error: string | null;
    createdAt: Date;
  } | null | undefined,
): TelegramSettingsDto {
  return {
    hasBotToken: Boolean(settings?.telegramBotToken),
    telegramChatId: settings?.telegramChatId ?? "",
    telegramAdminUserId: settings?.telegramAdminUserId ?? "",
    telegramAlerts: settings?.telegramAlerts ?? true,
    weeklyReportEnabled: settings?.weeklyReportEnabled ?? true,
    weeklyReportDay: settings?.weeklyReportDay ?? 1,
    weeklyReportHour: settings?.weeklyReportHour ?? 8,
    webhookConfigured: Boolean(settings?.telegramWebhookAt && settings.telegramWebhookUrl),
    webhookUrl: settings?.telegramWebhookUrl ?? null,
    lastDelivery: lastDelivery ? {
      status: lastDelivery.status,
      type: lastDelivery.type,
      error: lastDelivery.error,
      createdAt: lastDelivery.createdAt.toISOString(),
    } : null,
  };
}
