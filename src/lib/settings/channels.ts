import "server-only";

import { prisma } from "@/lib/db";
import { safeFacebookPage } from "@/lib/facebook-page-response";
import { safeGoogleAccountSelect } from "@/lib/channel-security";
import { decryptSecret } from "@/lib/secrets-crypto";
import { resolveSecretInput } from "@/lib/settings-secrets";
import {
  parseCanonicalZaloSettingsRequest,
  parseTelegramSettingsPatch,
  parseZaloTestRequest,
  toTelegramSettingsDto,
  toZaloSettingsDto,
} from "@/lib/settings/channels-policy";
import { persistSettingsPatch } from "@/lib/settings/persistence";

const settingsSelect = {
  zaloToken: true,
  zaloOaId: true,
  telegramBotToken: true,
  telegramChatId: true,
  telegramAdminUserId: true,
  telegramAlerts: true,
  weeklyReportEnabled: true,
  weeklyReportDay: true,
  weeklyReportHour: true,
  telegramWebhookAt: true,
  telegramWebhookUrl: true,
} as const;

const tikTokAccountSelect = {
  id: true,
  openId: true,
  displayName: true,
  avatarUrl: true,
  isActive: true,
  expiresAt: true,
} as const;

export async function getChannelSettings() {
  const [settings, facebookPages, tikTokAccounts, googleAccounts, lastDelivery] = await Promise.all([
    prisma.settings.findUnique({ where: { id: "1" }, select: settingsSelect }),
    prisma.facebookPage.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.tikTokAccount.findMany({ select: tikTokAccountSelect }),
    prisma.googleAccount.findMany({ select: safeGoogleAccountSelect }),
    prisma.telegramDelivery.findFirst({
      orderBy: { createdAt: "desc" },
      select: { status: true, type: true, error: true, createdAt: true },
    }),
  ]);

  return {
    facebookPages: facebookPages.map(safeFacebookPage),
    instagramPages: facebookPages.map((page) => ({
      id: page.id,
      pageName: page.pageName,
      fbPageId: page.fbPageId,
      igAccountId: page.igAccountId,
      igUsername: page.igUsername,
      isActive: page.isActive,
    })),
    tikTokAccounts: tikTokAccounts.map((account) => ({
      ...account,
      expiresAt: account.expiresAt?.toISOString() ?? null,
    })),
    googleAccounts: googleAccounts.map((account) => ({
      ...account,
      expiresAt: account.expiresAt?.toISOString() ?? null,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    })),
    zalo: toZaloSettingsDto(settings),
    telegram: toTelegramSettingsDto(settings, lastDelivery),
  };
}

export async function saveZaloSettings(
  input: unknown,
  audit: { userId: string; href: string; source: string },
) {
  const patch = parseCanonicalZaloSettingsRequest(input);
  const settings = await persistSettingsPatch(patch, audit);
  return toZaloSettingsDto(settings);
}

export async function testZaloSettings(input: unknown) {
  const request = parseZaloTestRequest(input);
  const settings = await prisma.settings.findUnique({
    where: { id: "1" },
    select: { zaloToken: true },
  });
  const token = resolveSecretInput(request.zaloToken, decryptSecret(settings?.zaloToken));
  if (!token) throw new Error("Chưa có Zalo Token — nhập token rồi kiểm tra");

  const response = await fetch("https://openapi.zalo.me/v2.0/oa/getoa", {
    headers: { access_token: token },
    signal: AbortSignal.timeout(30_000),
  });
  const data = await response.json().catch(() => null) as {
    error?: number;
    message?: string;
    data?: { name?: string };
  } | null;
  if (response.ok && data?.error === 0) {
    return { success: true, message: `Kết nối thành công! OA: ${data.data?.name ?? "OK"}` };
  }
  return { success: false, message: data?.message ?? `Zalo trả về lỗi ${response.status}` };
}

export async function saveTelegramSettings(
  input: unknown,
  audit: { userId: string; href: string; source: string },
) {
  const patch = parseTelegramSettingsPatch(input);
  const settings = await persistSettingsPatch(patch, audit);
  const lastDelivery = await prisma.telegramDelivery.findFirst({
    orderBy: { createdAt: "desc" },
    select: { status: true, type: true, error: true, createdAt: true },
  });
  return toTelegramSettingsDto(settings, lastDelivery);
}

export async function getTelegramSettings() {
  const [settings, lastDelivery] = await Promise.all([
    prisma.settings.findUnique({ where: { id: "1" }, select: settingsSelect }),
    prisma.telegramDelivery.findFirst({
      orderBy: { createdAt: "desc" },
      select: { status: true, type: true, error: true, createdAt: true },
    }),
  ]);
  return toTelegramSettingsDto(settings, lastDelivery);
}
