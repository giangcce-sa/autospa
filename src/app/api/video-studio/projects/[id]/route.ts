import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { accessErrorResponse, requirePageAccess } from "@/lib/page-access";
import { projectInclude } from "@/lib/video-studio/service";
import { serializeProject } from "@/lib/video-studio/serializers";
import { invalidatedProjectRenderData, PROJECT_RENDER_FIELDS } from "@/lib/video-studio/invalidation";
import { deleteMedia } from "@/lib/media-storage";

const updateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  brief: z.string().trim().min(10).max(5000).optional(),
  objective: z.enum(["awareness", "engagement", "lead", "booking", "retargeting"]).optional(),
  platform: z.enum(["tiktok", "instagram", "facebook", "multi"]).optional(),
  aspectRatio: z.enum(["9:16", "1:1", "16:9"]).optional(),
  durationSec: z.number().int().min(10).max(180).optional(),
  serviceId: z.string().nullable().optional(),
  staffProfileId: z.string().nullable().optional(),
  voiceProfileId: z.string().nullable().optional(),
  styleSkillIds: z.array(z.string()).max(12).optional(),
  styleStrength: z.number().min(0).max(1).optional(),
  caption: z.string().max(4000).nullable().optional(),
  hashtags: z.string().max(1000).nullable().optional(),
  approvalStatus: z.enum(["draft", "pending", "approved", "rejected"]).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const project = await prisma.videoProject.findUnique({ where: { id }, include: projectInclude });
    if (!project) return NextResponse.json({ success: false, error: "Không tìm thấy dự án" }, { status: 404 });
    await requirePageAccess(project.facebookPageId);
    return NextResponse.json({ success: true, data: serializeProject(project) });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const existing = await prisma.videoProject.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ success: false, error: "Không tìm thấy dự án" }, { status: 404 });
    const { user } = await requirePageAccess(existing.facebookPageId, { owner: true });
    const input = updateSchema.parse(await req.json());
    if (input.approvalStatus === "approved" && (!existing.outputUrl || (existing.qualityScore || 0) < 75 || existing.renderedRevision !== existing.inputRevision)) {
      return NextResponse.json({ success: false, error: "Chỉ duyệt video đã render và đạt tối thiểu 75 điểm QA" }, { status: 422 });
    }
    const { styleSkillIds, ...projectData } = input;
    const changedFields = Object.keys(input).filter((key) => input[key as keyof typeof input] !== existing[key as keyof typeof existing]);
    const invalidatesRender = changedFields.some((field) => PROJECT_RENDER_FIELDS.has(field));
    const approving = input.approvalStatus === "approved" && !invalidatesRender;
    const project = await prisma.videoProject.update({
      where: { id },
      data: {
        ...projectData,
        ...(styleSkillIds ? { styleSkillIds: JSON.stringify(styleSkillIds) } : {}),
        ...(invalidatesRender ? invalidatedProjectRenderData() : {}),
        ...(approving ? { approvedRevision: existing.inputRevision, approvedAt: new Date(), approvedBy: user.id || null, status: "approved" } : {}),
      },
    });
    return NextResponse.json({ success: true, data: project });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: error instanceof z.ZodError ? 400 : 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const project = await prisma.videoProject.findUnique({
      where: { id },
      include: { assets: { select: { storageKey: true } }, versions: { select: { storageKey: true } } },
    });
    if (!project) return NextResponse.json({ success: true });
    await requirePageAccess(project.facebookPageId, { owner: true });
    await prisma.videoProject.delete({ where: { id } });
    const keys = [...new Set([project.outputStorageKey, ...project.assets.map((item) => item.storageKey), ...project.versions.map((item) => item.storageKey)].filter((key): key is string => Boolean(key)))];
    await Promise.all(keys.map((key) => deleteMedia(key).catch(() => null)));
    return NextResponse.json({ success: true });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
