import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { accessErrorResponse, requirePageAccess } from "@/lib/page-access";
import { invalidatedProjectRenderData, sceneInvalidationFor } from "@/lib/video-studio/invalidation";
import { validateSceneMediaUrl } from "@/lib/video-studio/media-security";

const schema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  kind: z.enum(["talking", "broll", "title", "cta"]).optional(),
  purpose: z.string().max(500).nullable().optional(),
  durationSec: z.number().int().min(1).max(30).optional(),
  script: z.string().max(3000).optional(),
  visualPrompt: z.string().max(5000).optional(),
  negativePrompt: z.string().max(3000).nullable().optional(),
  cameraDirection: z.string().max(1000).nullable().optional(),
  staffProfileId: z.string().nullable().optional(),
  voiceProfileId: z.string().nullable().optional(),
  sourceImageUrl: z.string().nullable().optional(),
  sourceVideoUrl: z.string().nullable().optional(),
  locked: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const scene = await prisma.videoScene.findUnique({ where: { id }, include: { project: { select: { facebookPageId: true } } } });
    if (!scene) return NextResponse.json({ success: false, error: "Không tìm thấy cảnh" }, { status: 404 });
    await requirePageAccess(scene.project.facebookPageId, { owner: true });
    const data = schema.parse(await req.json());
    if (data.sourceImageUrl !== undefined) validateSceneMediaUrl(data.sourceImageUrl);
    if (data.sourceVideoUrl !== undefined) validateSceneMediaUrl(data.sourceVideoUrl);
    const changedFields = Object.keys(data).filter((key) => data[key as keyof typeof data] !== scene[key as keyof typeof scene]);
    const invalidation = sceneInvalidationFor(changedFields);
    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.videoScene.update({
        where: { id },
        data: {
          ...data,
          ...(invalidation.invalidatesProject ? { inputRevision: { increment: 1 }, status: "draft", qaScore: null, qaReport: null } : {}),
          ...(invalidation.clearVideo ? { generatedVideoUrl: null, providerTaskId: null, videoRevision: null } : {}),
          ...(invalidation.clearAudio ? { audioUrl: null, subtitleData: "[]", audioRevision: null } : {}),
          ...(invalidation.clearLipSync ? { lipSyncVideoUrl: null, lipSyncRevision: null } : {}),
        },
      });
      if (invalidation.invalidatesProject) {
        await tx.videoProject.update({
          where: { id: scene.projectId },
          data: invalidatedProjectRenderData(),
        });
      }
      return next;
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: error instanceof z.ZodError ? 400 : 500 });
  }
}
