import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { accessErrorResponse, requireUser } from "@/lib/page-access";
import { testVideoProviderSettings } from "@/lib/settings/video";
import { getVideoProviderConfig } from "@/lib/video-studio/config";

function publicStatus(config: Awaited<ReturnType<typeof getVideoProviderConfig>>) {
  return {
    mockMode: config.mockMode,
    executionPolicy: config.executionPolicy,
    budgetUsd: config.budgetUsd,
    providers: {
      runway: { configured: Boolean(config.runway.apiKey), model: config.runway.model },
      elevenLabs: { configured: Boolean(config.elevenLabs.apiKey), model: config.elevenLabs.model },
      sync: { configured: Boolean(config.sync.apiKey), model: config.sync.model },
      ffmpeg: { configured: true, model: "local" },
    },
  };
}

export async function GET() {
  try {
    await requireUser();
    return NextResponse.json({ success: true, data: publicStatus(await getVideoProviderConfig()) });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireUser({ owner: true });
    const request = z.object({ provider: z.enum(["runway", "elevenLabs", "sync"]) }).parse(await req.json());
    const config = await getVideoProviderConfig();
    if (config.mockMode) return NextResponse.json({ success: true, data: { provider: request.provider, message: "Đang dùng chế độ mock local" } });
    const result = await testVideoProviderSettings(request);
    return NextResponse.json({ success: true, data: { provider: request.provider, message: result.message } });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: error instanceof z.ZodError ? 400 : 502 });
  }
}
