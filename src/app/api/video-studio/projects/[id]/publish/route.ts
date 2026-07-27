import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { settingsErrorResponse } from "@/lib/api-response";
import { prisma } from "@/lib/db";
import { requirePageAccess } from "@/lib/page-access";
import { assertProjectPublishConsent } from "@/lib/video-studio/consent";
import { enqueueInternalVideoJob } from "@/lib/video-studio/worker";

const schema = z.object({ targets: z.array(z.enum(["facebook", "instagram", "tiktok"])).min(1), force: z.boolean().default(false) });

export const maxDuration = 300;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const input = schema.parse(await req.json());
    const project = await prisma.videoProject.findUnique({ where: { id } });
    if (!project) return NextResponse.json({ success: false, error: "Không tìm thấy dự án" }, { status: 404 });
    await requirePageAccess(project.facebookPageId, { owner: true });
    if (project.approvalStatus !== "approved" || !project.outputUrl || (project.qualityScore || 0) < 75) {
      return NextResponse.json({ success: false, error: "Video phải được render, vượt QA và duyệt trước khi đăng" }, { status: 422 });
    }
    if (project.outputUrl.startsWith("mock://")) return NextResponse.json({ success: false, error: "Không thể đăng output mock; hãy tắt Video Mock Mode và render lại" }, { status: 422 });
    if (project.renderedRevision !== project.inputRevision || project.approvedRevision !== project.inputRevision) {
      return NextResponse.json({ success: false, error: "Render hoặc approval không còn khớp dữ liệu hiện tại" }, { status: 422 });
    }
    await assertProjectPublishConsent(project.id);
    const targets = [...input.targets].sort();
    const job = await enqueueInternalVideoJob({
      projectId: id,
      type: "publish",
      payload: { targets, force: input.force, revision: project.inputRevision },
      idempotencyKey: `publish:${id}:${project.inputRevision}:${targets.join(",")}`,
    });
    return NextResponse.json({ success: true, data: job }, { status: 202 });
  } catch (error) {
    return settingsErrorResponse(error);
  }
}
