import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { accessErrorResponse, requirePageAccess } from "@/lib/page-access";
import { parseJson } from "@/lib/video-studio/types";

export async function GET(req: NextRequest) {
  try {
    const facebookPageId = new URL(req.url).searchParams.get("facebookPageId") || null;
    await requirePageAccess(facebookPageId);
    const data = await prisma.videoTemplate.findMany({ where: { facebookPageId, isActive: true }, orderBy: [{ usageCount: "desc" }, { updatedAt: "desc" }] });
    return NextResponse.json({ success: true, data: data.map((item) => ({ ...item, structure: parseJson(item.structure, {}) })) });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const input = z.object({ projectId: z.string(), name: z.string().trim().min(2).max(120), description: z.string().max(500).optional() }).parse(await req.json());
    const project = await prisma.videoProject.findUnique({ where: { id: input.projectId }, include: { scenes: { orderBy: { position: "asc" } } } });
    if (!project) return NextResponse.json({ success: false, error: "Không tìm thấy dự án" }, { status: 404 });
    await requirePageAccess(project.facebookPageId, { owner: true });
    const template = await prisma.videoTemplate.create({ data: { facebookPageId: project.facebookPageId, name: input.name, description: input.description, platform: project.platform, aspectRatio: project.aspectRatio, durationSec: project.durationSec, thumbnailUrl: project.thumbnailUrl, structure: JSON.stringify({ objective: project.objective, scenes: project.scenes.map(({ title, kind, purpose, durationSec, script, visualPrompt, cameraDirection }) => ({ title, kind, purpose, durationSec, script, visualPrompt, cameraDirection })) }) } });
    return NextResponse.json({ success: true, data: template }, { status: 201 });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: error instanceof z.ZodError ? 400 : 500 });
  }
}
