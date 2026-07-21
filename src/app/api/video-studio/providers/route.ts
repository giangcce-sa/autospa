import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { accessErrorResponse, requireUser } from "@/lib/page-access";
import { getVideoProviderConfig } from "@/lib/video-studio/config";
import { providerFetch } from "@/lib/video-studio/http";

function publicStatus(config: Awaited<ReturnType<typeof getVideoProviderConfig>>) {
  return {
    mockMode: config.mockMode,
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
    const { provider } = z.object({ provider: z.enum(["runway", "elevenLabs", "sync"]) }).parse(await req.json());
    const config = await getVideoProviderConfig();
    if (config.mockMode) return NextResponse.json({ success: true, data: { provider, message: "Đang dùng chế độ mock local" } });
    if (provider === "runway") {
      if (!config.runway.apiKey) throw new Error("Chưa nhập khóa truy cập Runway");
      await providerFetch(`${config.runway.baseUrl}/v1/tasks?limit=1`, { headers: { Authorization: `Bearer ${config.runway.apiKey}`, "X-Runway-Version": "2024-11-06" } }, 30_000);
    } else if (provider === "elevenLabs") {
      if (!config.elevenLabs.apiKey) throw new Error("Chưa nhập khóa truy cập ElevenLabs");
      await providerFetch(`${config.elevenLabs.baseUrl}/v1/voices`, { headers: { "xi-api-key": config.elevenLabs.apiKey } }, 30_000);
    } else {
      if (!config.sync.apiKey) throw new Error("Chưa nhập khóa truy cập Sync Labs");
      await providerFetch(`${config.sync.baseUrl}/v2/models`, { headers: { "x-api-key": config.sync.apiKey } }, 30_000);
    }
    return NextResponse.json({ success: true, data: { provider, message: "Kết nối thành công" } });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: error instanceof z.ZodError ? 400 : 502 });
  }
}
