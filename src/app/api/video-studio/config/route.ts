import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { accessErrorResponse, requireUser } from "@/lib/page-access";
import { decryptVideoSecret, encryptVideoSecret } from "@/lib/video-studio/secrets";
import { assertSafeProviderBaseUrl } from "@/lib/video-studio/media-security";
import { sameProviderOrigin } from "@/lib/provider-url-validation";

const schema = z.object({
  runwayApiKey: z.string().trim().optional(),
  runwayBaseUrl: z.string().url().optional(),
  runwayVideoModel: z.string().trim().min(1).max(100).optional(),
  elevenLabsApiKey: z.string().trim().optional(),
  elevenLabsBaseUrl: z.string().url().optional(),
  elevenLabsVoiceModel: z.string().trim().min(1).max(100).optional(),
  syncLabsApiKey: z.string().trim().optional(),
  syncLabsBaseUrl: z.string().url().optional(),
  syncLabsModel: z.string().trim().min(1).max(100).optional(),
  videoMockMode: z.boolean().optional(),
  videoBudgetUsd: z.number().min(1).max(10000).optional(),
});

function mask(value?: string | null) {
  if (!value) return null;
  const decrypted = decryptVideoSecret(value);
  return decrypted ? `••••••••${decrypted.slice(-4)}` : null;
}

export async function GET() {
  try {
    await requireUser();
    const settings = await prisma.settings.findFirst();
    return NextResponse.json({ success: true, data: {
      runwayApiKey: mask(settings?.runwayApiKey),
      runwayBaseUrl: settings?.runwayBaseUrl || "https://api.dev.runwayml.com",
      runwayVideoModel: settings?.runwayVideoModel || "gen4.5",
      elevenLabsApiKey: mask(settings?.elevenLabsApiKey),
      elevenLabsBaseUrl: settings?.elevenLabsBaseUrl || "https://api.elevenlabs.io",
      elevenLabsVoiceModel: settings?.elevenLabsVoiceModel || "eleven_multilingual_v2",
      syncLabsApiKey: mask(settings?.syncLabsApiKey),
      syncLabsBaseUrl: settings?.syncLabsBaseUrl || "https://api.sync.so",
      syncLabsModel: settings?.syncLabsModel || "sync-3",
      videoMockMode: settings?.videoMockMode ?? true,
      videoBudgetUsd: settings?.videoBudgetUsd ?? 25,
      configured: { runway: Boolean(settings?.runwayApiKey || process.env.RUNWAY_API_KEY), elevenLabs: Boolean(settings?.elevenLabsApiKey || process.env.ELEVENLABS_API_KEY), sync: Boolean(settings?.syncLabsApiKey || process.env.SYNC_API_KEY) },
    } });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireUser({ owner: true });
    const input = schema.parse(await req.json());
    const current = await prisma.settings.findFirst({
      select: { runwayApiKey: true, runwayBaseUrl: true, elevenLabsApiKey: true, elevenLabsBaseUrl: true, syncLabsApiKey: true, syncLabsBaseUrl: true },
    });
    if (input.runwayBaseUrl) {
      input.runwayBaseUrl = await assertSafeProviderBaseUrl("runway", input.runwayBaseUrl);
      if (current?.runwayApiKey && (!input.runwayApiKey || input.runwayApiKey.includes("••")) && !sameProviderOrigin(input.runwayBaseUrl, current.runwayBaseUrl)) {
        return NextResponse.json({ success: false, error: "Khi đổi gateway Runway, bạn phải nhập lại khóa truy cập" }, { status: 400 });
      }
    }
    if (input.elevenLabsBaseUrl) {
      input.elevenLabsBaseUrl = await assertSafeProviderBaseUrl("elevenLabs", input.elevenLabsBaseUrl);
      if (current?.elevenLabsApiKey && (!input.elevenLabsApiKey || input.elevenLabsApiKey.includes("••")) && !sameProviderOrigin(input.elevenLabsBaseUrl, current.elevenLabsBaseUrl)) {
        return NextResponse.json({ success: false, error: "Khi đổi gateway ElevenLabs, bạn phải nhập lại khóa truy cập" }, { status: 400 });
      }
    }
    if (input.syncLabsBaseUrl) {
      input.syncLabsBaseUrl = await assertSafeProviderBaseUrl("sync", input.syncLabsBaseUrl);
      if (current?.syncLabsApiKey && (!input.syncLabsApiKey || input.syncLabsApiKey.includes("••")) && !sameProviderOrigin(input.syncLabsBaseUrl, current.syncLabsBaseUrl)) {
        return NextResponse.json({ success: false, error: "Khi đổi gateway Sync Labs, bạn phải nhập lại khóa truy cập" }, { status: 400 });
      }
    }
    const data = Object.fromEntries(Object.entries(input)
      .filter(([key, value]) => !(key.endsWith("ApiKey") && (!value || String(value).includes("••"))))
      .map(([key, value]) => [key, key.endsWith("ApiKey") && typeof value === "string" ? encryptVideoSecret(value) : value]));
    const settings = await prisma.settings.upsert({ where: { id: "1" }, create: { id: "1", ...data }, update: data });
    return NextResponse.json({ success: true, data: { videoMockMode: settings.videoMockMode, videoBudgetUsd: settings.videoBudgetUsd } });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: error instanceof z.ZodError ? 400 : 500 });
  }
}
