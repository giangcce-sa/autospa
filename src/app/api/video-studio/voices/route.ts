import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { settingsErrorResponse } from "@/lib/api-response";
import { prisma } from "@/lib/db";
import { requirePageAccess } from "@/lib/page-access";
import { cloneVoice } from "@/lib/video-studio/providers/elevenlabs";
import { parseJson } from "@/lib/video-studio/types";

const createSchema = z.object({
  facebookPageId: z.string().nullable().optional(),
  staffProfileId: z.string().min(1),
  consentId: z.string().min(1),
  sampleAssetId: z.string().min(1),
  name: z.string().trim().min(2).max(100),
  description: z.string().max(800).optional(),
  clone: z.boolean().default(true),
  settings: z.object({ stability: z.number().min(0).max(1).optional(), similarityBoost: z.number().min(0).max(1).optional(), style: z.number().min(0).max(1).optional(), speed: z.number().min(0.7).max(1.3).optional() }).default({}),
});

export async function GET(req: NextRequest) {
  try {
    const facebookPageId = new URL(req.url).searchParams.get("facebookPageId") || null;
    await requirePageAccess(facebookPageId);
    const voices = await prisma.videoVoiceProfile.findMany({ where: { facebookPageId, isActive: true }, orderBy: { updatedAt: "desc" } });
    return NextResponse.json({ success: true, data: voices.map((voice) => ({ ...voice, settings: parseJson(voice.settings, {}), pronunciation: parseJson(voice.pronunciation, {}) })) });
  } catch (error) {
    return settingsErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const input = createSchema.parse(await req.json());
    await requirePageAccess(input.facebookPageId, { owner: true });
    const [consent, asset, staff] = await Promise.all([
      prisma.videoConsent.findFirst({
        where: { id: input.consentId, facebookPageId: input.facebookPageId || null, subjectType: "staff", subjectId: input.staffProfileId },
      }),
      prisma.videoAsset.findFirst({
        where: { id: input.sampleAssetId, project: { facebookPageId: input.facebookPageId || null }, type: "voice_sample", status: "ready" },
      }),
      prisma.staffVisualProfile.findFirst({
        where: { id: input.staffProfileId, facebookPageId: input.facebookPageId || null, isActive: true },
      }),
    ]);
    const scopes = parseJson<string[]>(consent?.scopes, []);
    if (!consent || consent.status !== "active" || !consent.evidenceHash || !scopes.includes("voice_clone") || (consent.expiresAt && consent.expiresAt <= new Date())) {
      return NextResponse.json({ success: false, error: "Chưa có xác nhận hợp lệ cho phép sao chép giọng" }, { status: 422 });
    }
    if (!staff || staff.consentStatus !== "consented") return NextResponse.json({ success: false, error: "Nhân viên chưa đồng ý sử dụng danh tính" }, { status: 422 });
    if (!asset?.storageKey || !asset.mimeType?.startsWith("audio/")) return NextResponse.json({ success: false, error: "Mẫu giọng không hợp lệ" }, { status: 422 });
    const provider = input.clone ? await cloneVoice({ name: input.name, description: input.description, storageKey: asset.storageKey }) : { voiceId: undefined };
    const voice = await prisma.videoVoiceProfile.create({
      data: {
        facebookPageId: input.facebookPageId || null,
        staffProfileId: input.staffProfileId,
        consentId: input.consentId,
        name: input.name,
        description: input.description,
        providerVoiceId: provider.voiceId,
        sampleUrl: asset.url,
        sampleStorageKey: asset.storageKey,
        settings: JSON.stringify(input.settings),
        status: "active",
      },
    });
    return NextResponse.json({ success: true, data: voice }, { status: 201 });
  } catch (error) {
    return settingsErrorResponse(error);
  }
}
