import { NextResponse } from "next/server";
import { settingsErrorResponse } from "@/lib/api-response";
import { prisma } from "@/lib/db";
import { requirePageAccess } from "@/lib/page-access";
import { buildStoryboard } from "@/lib/video-studio/service";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const project = await prisma.videoProject.findUnique({ where: { id }, select: { facebookPageId: true } });
    if (!project) return NextResponse.json({ success: false, error: "Không tìm thấy dự án" }, { status: 404 });
    await requirePageAccess(project.facebookPageId, { owner: true });
    return NextResponse.json({ success: true, data: await buildStoryboard(id) });
  } catch (error) {
    return settingsErrorResponse(error);
  }
}
