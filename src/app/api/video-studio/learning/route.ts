import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { settingsErrorResponse } from "@/lib/api-response";
import { prisma } from "@/lib/db";
import { requirePageAccess } from "@/lib/page-access";
import { enqueueInternalVideoJob } from "@/lib/video-studio/worker";

export const maxDuration = 600;
const schema = z.object({ projectId: z.string(), assetId: z.string() });

export async function POST(req: NextRequest) {
  try {
    const input = schema.parse(await req.json());
    const project = await prisma.videoProject.findUnique({ where: { id: input.projectId }, select: { facebookPageId: true } });
    if (!project) return NextResponse.json({ success: false, error: "Không tìm thấy dự án" }, { status: 404 });
    await requirePageAccess(project.facebookPageId, { owner: true });
    const asset = await prisma.videoAsset.findFirst({
      where: { id: input.assetId, projectId: input.projectId, type: "source_video", status: "ready" },
      select: { id: true },
    });
    if (!asset) return NextResponse.json({ success: false, error: "Video học không thuộc dự án hoặc chưa sẵn sàng" }, { status: 404 });
    const job = await enqueueInternalVideoJob({ projectId: input.projectId, type: "learning", payload: { assetId: input.assetId, facebookPageId: project.facebookPageId }, idempotencyKey: `learning:${input.projectId}:${input.assetId}` });
    return NextResponse.json({ success: true, data: job }, { status: 202 });
  } catch (error) {
    return settingsErrorResponse(error);
  }
}
