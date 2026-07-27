import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { settingsErrorResponse } from "@/lib/api-response";
import { prisma } from "@/lib/db";
import { requirePageAccess } from "@/lib/page-access";
import { invalidatedProjectRenderData } from "@/lib/video-studio/invalidation";
import { generateSceneLipSync, generateSceneVideo, generateSceneVoice } from "@/lib/video-studio/service";

const schema = z.object({ action: z.enum(["generate-video", "generate-voice", "lip-sync", "move-up", "move-down"]) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const scene = await prisma.videoScene.findUnique({ where: { id }, include: { project: { select: { facebookPageId: true } } } });
    if (!scene) return NextResponse.json({ success: false, error: "Không tìm thấy cảnh" }, { status: 404 });
    await requirePageAccess(scene.project.facebookPageId, { owner: true });
    const { action } = schema.parse(await req.json());
    if (action === "move-up" || action === "move-down") {
      const adjacent = await prisma.videoScene.findFirst({
        where: { projectId: scene.projectId, position: action === "move-up" ? { lt: scene.position } : { gt: scene.position } },
        orderBy: { position: action === "move-up" ? "desc" : "asc" },
      });
      if (!adjacent) return NextResponse.json({ success: true, data: scene });
      await prisma.$transaction(async (tx) => {
        await tx.videoScene.update({ where: { id: scene.id }, data: { position: -1 } });
        await tx.videoScene.update({ where: { id: adjacent.id }, data: { position: scene.position } });
        await tx.videoScene.update({ where: { id: scene.id }, data: { position: adjacent.position } });
        await tx.videoProject.update({ where: { id: scene.projectId }, data: invalidatedProjectRenderData() });
      });
      return NextResponse.json({ success: true, data: { moved: true } });
    }
    const data = action === "generate-video" ? await generateSceneVideo(id) : action === "generate-voice" ? await generateSceneVoice(id) : await generateSceneLipSync(id);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return settingsErrorResponse(error);
  }
}
