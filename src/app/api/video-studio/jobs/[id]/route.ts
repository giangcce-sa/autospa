import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { accessErrorResponse, requirePageAccess } from "@/lib/page-access";
import { cancelVideoJob } from "@/lib/video-studio/service";

const safeJobSelect = {
  id: true,
  type: true,
  provider: true,
  status: true,
  progress: true,
  attempt: true,
  error: true,
  startedAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  project: { select: { facebookPageId: true } },
} as const;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const job = await prisma.videoJob.findUnique({ where: { id }, select: safeJobSelect });
    if (!job) return NextResponse.json({ success: false, error: "Không tìm thấy job" }, { status: 404 });
    await requirePageAccess(job.project.facebookPageId);

    return NextResponse.json({
      success: true,
      data: {
        id: job.id,
        type: job.type,
        provider: job.provider,
        status: job.status,
        progress: job.progress,
        attempt: job.attempt,
        error: job.error,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      },
    });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const job = await prisma.videoJob.findUnique({
      where: { id },
      select: { status: true, project: { select: { facebookPageId: true } } },
    });
    if (!job) return NextResponse.json({ success: true });
    await requirePageAccess(job.project.facebookPageId, { owner: true });
    if (!["queued", "processing"].includes(job.status)) {
      return NextResponse.json({ success: false, error: "Job đã kết thúc" }, { status: 409 });
    }
    await cancelVideoJob(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
