import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { accessErrorResponse, requireUser } from "@/lib/page-access";
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
    return videoConfigErrorResponse(error);
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
    return videoConfigErrorResponse(error);
  }
}

function videoConfigErrorResponse(error: unknown) {
  const access = accessErrorResponse(error);
  if (access) return access;
  const message = error instanceof ZodError
    ? error.issues[0]?.message ?? "Cấu hình video không hợp lệ"
    : error instanceof Error ? error.message : String(error);
  return NextResponse.json(
    { success: false, error: message },
    { status: error instanceof ZodError || message.includes("gateway") || message.includes("Base URL") ? 400 : 500 },
  );
}
