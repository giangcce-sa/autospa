import "server-only";

import { getAdsSettings } from "@/lib/settings/ads";
import { getAutomationSettings } from "@/lib/settings/automation";
import { getChannelSettings } from "@/lib/settings/channels";
import { getConnectionSettings } from "@/lib/settings/connections";
import { getDataSettings } from "@/lib/settings/data";
import { buildSettingsOverview } from "@/lib/settings/overview-policy";
import { getImageSettings, getProviderSettings } from "@/lib/settings/providers";
import { getVideoSettings } from "@/lib/settings/video";

export async function getSettingsOverview() {
  const [connections, channels, providers, images, video, ads, automation, data] = await Promise.all([
    getConnectionSettings(),
    getChannelSettings(),
    getProviderSettings(),
    getImageSettings(),
    getVideoSettings(),
    getAdsSettings(),
    getAutomationSettings(),
    getDataSettings(),
  ]);

  const activeFacebookPages = channels.facebookPages.filter((page) => page.isActive).length;
  const activeInstagramPages = channels.instagramPages.filter((page) => page.isActive && page.igAccountId).length;
  const activeTikTokAccounts = channels.tikTokAccounts.filter((account) => account.isActive).length;
  const activeGoogleAccounts = channels.googleAccounts.filter((account) => account.isActive).length;
  const zaloConnected = channels.zalo.hasZaloToken && Boolean(channels.zalo.zaloOaId);
  const telegramConnected = channels.telegram.hasBotToken && Boolean(channels.telegram.telegramChatId);

  return buildSettingsOverview({
    connections: {
      hasUrl: Boolean(connections.spaApiUrl),
      hasApiKey: connections.hasSpaApiKey,
      hasWebhookSecret: connections.hasSpaWebhookSecret,
    },
    channels: {
      connected: [
        activeFacebookPages > 0,
        activeInstagramPages > 0,
        activeTikTokAccounts > 0,
        activeGoogleAccounts > 0,
        zaloConnected,
        telegramConnected,
      ].filter(Boolean).length,
      total: 6,
    },
    providers: {
      claude: providers.hasClaudeApiKey,
      openai: providers.hasOpenaiApiKey,
    },
    images: {
      model: images.imageModel,
      storageProvider: images.storage.provider,
      storageConfigured: images.storage.configured,
    },
    video: {
      mockMode: video.videoMockMode,
      runway: video.hasRunwayApiKey,
      elevenLabs: video.hasElevenLabsApiKey,
      sync: video.hasSyncLabsApiKey,
      deploymentKeyCount: [video.runwayKeySource, video.elevenLabsKeySource, video.syncLabsKeySource]
        .filter((source) => source === "deployment").length,
    },
    ads: {
      executionMode: ads.executionMode,
      emergencyStop: ads.emergencyStop,
      forcedDryRun: ads.forcedDryRun,
      allowedPageCount: ads.allowedFacebookPageIds.length,
      allowedAdAccountCount: ads.allowedAdAccountIds.length,
    },
    automation: {
      webhookMode: automation.webhookMode,
      hasWebhookVerifyToken: automation.hasWebhookVerifyToken,
      automationLevel: automation.automationLevel,
    },
    data,
  });
}
