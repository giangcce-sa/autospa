import "server-only";

import { prisma } from "@/lib/db";
import { decryptVideoSecret } from "./secrets";
import { assertSafeProviderBaseUrl } from "./media-security";

export interface VideoProviderConfig {
  mockMode: boolean;
  budgetUsd: number;
  runway: { apiKey?: string; baseUrl: string; model: string };
  elevenLabs: { apiKey?: string; baseUrl: string; model: string };
  sync: { apiKey?: string; baseUrl: string; model: string };
}

function cleanBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

export async function getVideoProviderConfig(): Promise<VideoProviderConfig> {
  const settings = await prisma.settings.findFirst();
  const mockMode = settings?.videoMockMode ?? process.env.VIDEO_MOCK_MODE !== "false";
  const config: VideoProviderConfig = {
    mockMode,
    budgetUsd: settings?.videoBudgetUsd ?? Number(process.env.VIDEO_BUDGET_USD || 25),
    runway: {
      apiKey: decryptVideoSecret(settings?.runwayApiKey) || process.env.RUNWAY_API_KEY || process.env.RUNWAYML_API_SECRET,
      baseUrl: cleanBaseUrl(settings?.runwayBaseUrl || process.env.RUNWAY_BASE_URL || "https://api.dev.runwayml.com"),
      model: settings?.runwayVideoModel || process.env.RUNWAY_VIDEO_MODEL || "gen4.5",
    },
    elevenLabs: {
      apiKey: decryptVideoSecret(settings?.elevenLabsApiKey) || process.env.ELEVENLABS_API_KEY,
      baseUrl: cleanBaseUrl(settings?.elevenLabsBaseUrl || process.env.ELEVENLABS_BASE_URL || "https://api.elevenlabs.io"),
      model: settings?.elevenLabsVoiceModel || process.env.ELEVENLABS_VOICE_MODEL || "eleven_multilingual_v2",
    },
    sync: {
      apiKey: decryptVideoSecret(settings?.syncLabsApiKey) || process.env.SYNC_API_KEY,
      baseUrl: cleanBaseUrl(settings?.syncLabsBaseUrl || process.env.SYNC_BASE_URL || "https://api.sync.so"),
      model: settings?.syncLabsModel || process.env.SYNC_MODEL || "sync-3",
    },
  };
  if (!mockMode) {
    const [runway, elevenLabs, sync] = await Promise.all([
      assertSafeProviderBaseUrl("runway", config.runway.baseUrl),
      assertSafeProviderBaseUrl("elevenLabs", config.elevenLabs.baseUrl),
      assertSafeProviderBaseUrl("sync", config.sync.baseUrl),
    ]);
    config.runway.baseUrl = runway;
    config.elevenLabs.baseUrl = elevenLabs;
    config.sync.baseUrl = sync;
  }
  return config;
}

export function requireProviderKey(provider: string, key?: string) {
  if (!key) throw new Error(`Chưa cấu hình API key cho ${provider}`);
  return key;
}
