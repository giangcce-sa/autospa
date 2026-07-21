import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { accessErrorResponse, requirePageAccess } from "@/lib/page-access";
import { runProjectQuality } from "@/lib/video-studio/service";
import { enqueueInternalVideoJob } from "@/lib/video-studio/worker";

export const maxDuration = 600;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const project = await prisma.videoProject.findUnique({ where: { id }, select: { facebookPageId: true } });
    if (!project) return NextResponse.json({ success: false, error: "Không tìm thấy dự án" }, { status: 404 });
    await requirePageAccess(project.facebookPageId, { owner: true });
    const quality = await runProjectQuality(id);
    if (!quality.passed) return NextResponse.json({ success: false, error: "Video chưa vượt qua kiểm tra chất lượng", data: quality }, { status: 422 });
    const current = await prisma.videoProject.findUnique({ where: { id }, select: { inputRevision: true } });
    const job = await enqueueInternalVideoJob({ projectId: id, type: "render", payload: { revision: current?.inputRevision }, idempotencyKey: `render:${id}:${current?.inputRevision}` });
    return NextResponse.json({ success: true, data: job }, { status: 202 });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
