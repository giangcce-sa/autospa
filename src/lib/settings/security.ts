import "server-only";

import { prisma } from "@/lib/db";
import { resolveMediaStoragePolicy } from "@/lib/media-storage-policy";
import { buildSecurityConfiguration } from "@/lib/settings/security-policy";

const secretSelect = {
  claudeApiKey: true,
  openaiApiKey: true,
  spaApiKey: true,
  spaWebhookSecret: true,
  webhookVerifyToken: true,
  zaloToken: true,
  telegramBotToken: true,
  runwayApiKey: true,
  elevenLabsApiKey: true,
  syncLabsApiKey: true,
} as const;

export async function getSecuritySettings() {
  const mediaStorage = resolveMediaStoragePolicy();
  const [settings, users, pageAccessCount, audits] = await Promise.all([
    prisma.settings.findUnique({ where: { id: "1" }, select: secretSelect }),
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, name: true, role: true, lastLoginAt: true, createdAt: true },
    }),
    prisma.userPageAccess.count(),
    prisma.activityLog.findMany({
      where: { type: "settings_change" },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { id: true, title: true, detail: true, href: true, source: true, createdAt: true },
    }),
  ]);

  const configuration = buildSecurityConfiguration({
    databaseSecrets: {
      claude: Boolean(settings?.claudeApiKey),
      openai: Boolean(settings?.openaiApiKey),
      spaApi: Boolean(settings?.spaApiKey),
      spaWebhook: Boolean(settings?.spaWebhookSecret),
      webhookVerify: Boolean(settings?.webhookVerifyToken),
      zalo: Boolean(settings?.zaloToken),
      telegram: Boolean(settings?.telegramBotToken),
      runway: Boolean(settings?.runwayApiKey),
      elevenLabs: Boolean(settings?.elevenLabsApiKey),
      sync: Boolean(settings?.syncLabsApiKey),
    },
    deployment: {
      authSecret: Boolean(process.env.AUTH_SECRET),
      cronSecret: Boolean(process.env.CRON_SECRET),
      publicBaseUrl: process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL,
      mediaStorageProvider: mediaStorage.provider,
      mediaStorageConfigured: mediaStorage.configured,
      mediaStorageBlocker: mediaStorage.blocker,
      deploymentMode: mediaStorage.deploymentMode,
      deploymentModeSource: mediaStorage.deploymentModeSource,
      runway: Boolean(process.env.RUNWAY_API_KEY || process.env.RUNWAYML_API_SECRET),
      elevenLabs: Boolean(process.env.ELEVENLABS_API_KEY),
      sync: Boolean(process.env.SYNC_API_KEY),
    },
  });

  return {
    ...configuration,
    session: {
      strategy: "jwt" as const,
      databaseSessionTracking: false,
    },
    users: users.map((user) => ({
      ...user,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    })),
    pageAccessCount,
    audits: audits.map((audit) => ({
      ...audit,
      createdAt: audit.createdAt.toISOString(),
    })),
  };
}

export type SecuritySettingsDto = Awaited<ReturnType<typeof getSecuritySettings>>;
