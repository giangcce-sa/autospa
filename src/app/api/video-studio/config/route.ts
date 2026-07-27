import { NextRequest, NextResponse } from "next/server";
import { settingsErrorResponse } from "@/lib/api-response";
import { requireUser } from "@/lib/page-access";
import { getVideoSettings, saveVideoSettings } from "@/lib/settings/video";

function compatibilityDto(settings: Awaited<ReturnType<typeof getVideoSettings>>) {
  return {
    runwayApiKey: settings.hasRunwayApiKey ? "••••••••" : null,
    runwayBaseUrl: settings.runwayBaseUrl,
    runwayVideoModel: settings.runwayVideoModel,
    elevenLabsApiKey: settings.hasElevenLabsApiKey ? "••••••••" : null,
    elevenLabsBaseUrl: settings.elevenLabsBaseUrl,
    elevenLabsVoiceModel: settings.elevenLabsVoiceModel,
    syncLabsApiKey: settings.hasSyncLabsApiKey ? "••••••••" : null,
    syncLabsBaseUrl: settings.syncLabsBaseUrl,
    syncLabsModel: settings.syncLabsModel,
    videoMockMode: settings.videoMockMode,
    videoBudgetUsd: settings.videoBudgetUsd,
    configured: {
      runway: settings.hasRunwayApiKey,
      elevenLabs: settings.hasElevenLabsApiKey,
      sync: settings.hasSyncLabsApiKey,
    },
  };
}

export async function GET() {
  try {
    await requireUser();
    return NextResponse.json({ success: true, data: compatibilityDto(await getVideoSettings()) });
  } catch (error) {
    return settingsErrorResponse(error, "Cấu hình video không hợp lệ");
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser({ owner: true });
    const settings = await saveVideoSettings(await req.json(), {
      userId: user.id ?? user.email ?? "owner",
      href: "/system/settings?view=video&scope=account",
      source: "video_studio_config_compatibility_api",
    }, { canonical: false });
    return NextResponse.json({ success: true, data: compatibilityDto(settings) });
  } catch (error) {
    return settingsErrorResponse(error, "Cấu hình video không hợp lệ");
  }
}
