import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { accessErrorResponse, requirePageAccess } from "@/lib/page-access";
import { videoPosterUrl, videoRevisionState } from "@/lib/media-gallery";

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  brief: z.string().trim().min(10).max(5000),
  facebookPageId: z.string().nullable().optional(),
  objective: z.enum(["awareness", "engagement", "lead", "booking", "retargeting"]).default("awareness"),
  platform: z.enum(["tiktok", "instagram", "facebook", "multi"]).default("tiktok"),
  aspectRatio: z.enum(["9:16", "1:1", "16:9"]).default("9:16"),
  durationSec: z.number().int().min(10).max(180).default(30),
  serviceId: z.string().nullable().optional(),
  staffProfileId: z.string().nullable().optional(),
  voiceProfileId: z.string().nullable().optional(),
  templateId: z.string().nullable().optional(),
  styleSkillIds: z.array(z.string()).max(12).default([]),
  styleStrength: z.number().min(0).max(1).default(0.7),
});

export async function GET(req: NextRequest) {
  try {
    const facebookPageId = new URL(req.url).searchParams.get("facebookPageId") || null;
    await requirePageAccess(facebookPageId);
    const projects = await prisma.videoProject.findMany({
      where: { facebookPageId },
      orderBy: { updatedAt: "desc" },
      take: 80,
      select: {
        id: true,
        name: true,
        brief: true,
        status: true,
        approvalStatus: true,
        platform: true,
        aspectRatio: true,
        durationSec: true,
        qualityScore: true,
        outputUrl: true,
        thumbnailUrl: true,
        inputRevision: true,
        renderedRevision: true,
        approvedRevision: true,
        publishedPostId: true,
        updatedAt: true,
        _count: { select: { scenes: true, jobs: true, versions: true } },
        scenes: { orderBy: { position: "asc" }, take: 1, select: { sourceImageUrl: true } },
        jobs: {
          where: { status: { in: ["queued", "processing"] } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { status: true, progress: true },
        },
      },
    });
    const data = projects.map((project) => {
      const revisions = videoRevisionState(project.inputRevision, project.renderedRevision, project.approvedRevision);
      const firstSceneImageUrl = project.scenes[0]?.sourceImageUrl ?? null;
      return {
        ...project,
        posterUrl: videoPosterUrl({
          thumbnailUrl: project.thumbnailUrl,
          firstSceneImageUrl,
          inputRevision: project.inputRevision,
          renderedRevision: project.renderedRevision,
        }),
        firstSceneImageUrl,
        renderFresh: revisions.renderFresh,
        approvalFresh: revisions.approvalFresh,
        mock: project.outputUrl?.startsWith("mock://") ?? false,
        activeJob: project.jobs[0] ?? null,
        jobs: undefined,
        scenes: undefined,
      };
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const input = createSchema.parse(await req.json());
    const { user } = await requirePageAccess(input.facebookPageId, { owner: true });
    const pageId = input.facebookPageId || null;
    const [service, staff, voice, template, skillCount] = await Promise.all([
      input.serviceId ? prisma.service.findFirst({ where: { id: input.serviceId, facebookPageId: pageId }, select: { id: true } }) : null,
      input.staffProfileId ? prisma.staffVisualProfile.findFirst({ where: { id: input.staffProfileId, facebookPageId: pageId, isActive: true }, select: { id: true } }) : null,
      input.voiceProfileId ? prisma.videoVoiceProfile.findFirst({ where: { id: input.voiceProfileId, facebookPageId: pageId, isActive: true, status: "active" }, select: { id: true } }) : null,
      input.templateId ? prisma.videoTemplate.findFirst({ where: { id: input.templateId, facebookPageId: pageId, isActive: true }, select: { id: true } }) : null,
      input.styleSkillIds.length ? prisma.videoSkill.count({ where: { id: { in: input.styleSkillIds }, facebookPageId: pageId, status: "approved" } }) : 0,
    ]);
    if ((input.serviceId && !service) || (input.staffProfileId && !staff) || (input.voiceProfileId && !voice) || (input.templateId && !template) || skillCount !== input.styleSkillIds.length) {
      return NextResponse.json({ success: false, error: "Dịch vụ, nhân viên, voice, template hoặc skill không thuộc Page hiện tại" }, { status: 422 });
    }
    const project = await prisma.videoProject.create({
      data: {
        ...input,
        facebookPageId: input.facebookPageId || null,
        serviceId: input.serviceId || null,
        staffProfileId: input.staffProfileId || null,
        voiceProfileId: input.voiceProfileId || null,
        templateId: input.templateId || null,
        styleSkillIds: JSON.stringify(input.styleSkillIds),
        createdById: user.id || null,
      },
    });
    if (input.templateId) {
      await prisma.videoTemplate.update({ where: { id: input.templateId }, data: { usageCount: { increment: 1 } } }).catch(() => null);
    }
    return NextResponse.json({ success: true, data: project }, { status: 201 });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    const status = error instanceof z.ZodError ? 400 : 500;
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status });
  }
}
