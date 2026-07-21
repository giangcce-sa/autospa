import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { deleteMedia, saveMedia } from "@/lib/media-storage";
import { accessErrorResponse, requirePageAccess } from "@/lib/page-access";
import { assertMediaSignature, mediaChecksum, probeMediaBuffer } from "@/lib/video-studio/media-security";

const MAX_VIDEO_BYTES = 150 * 1024 * 1024;
const MAX_AUDIO_BYTES = 40 * 1024 * 1024;
const TYPES: Record<string, { type: string; extensions: string[] }> = {
  "video/mp4": { type: "video", extensions: ["mp4"] },
  "video/quicktime": { type: "video", extensions: ["mov"] },
  "video/webm": { type: "video", extensions: ["webm"] },
  "audio/mpeg": { type: "audio", extensions: ["mp3"] },
  "audio/wav": { type: "audio", extensions: ["wav"] },
  "audio/x-wav": { type: "audio", extensions: ["wav"] },
  "audio/mp4": { type: "audio", extensions: ["m4a"] },
};
const purposeSchema = z.enum(["source_video", "source_audio", "voice_sample", "music", "broll"]);

export async function POST(req: NextRequest) {
  let storedKey: string | null = null;
  try {
    const form = await req.formData();
    const file = form.get("file");
    const projectId = String(form.get("projectId") || "");
    const sceneId = form.get("sceneId") ? String(form.get("sceneId")) : null;
    const purpose = purposeSchema.parse(String(form.get("purpose") || "source_video"));
    if (!(file instanceof File) || !projectId) return NextResponse.json({ success: false, error: "Thiếu file hoặc projectId" }, { status: 400 });
    const project = await prisma.videoProject.findUnique({ where: { id: projectId }, select: { facebookPageId: true } });
    if (!project) return NextResponse.json({ success: false, error: "Không tìm thấy dự án" }, { status: 404 });
    await requirePageAccess(project.facebookPageId, { owner: true });
    const scene = sceneId ? await prisma.videoScene.findFirst({ where: { id: sceneId, projectId } }) : null;
    if (sceneId && !scene) return NextResponse.json({ success: false, error: "Scene không thuộc project đã chọn" }, { status: 404 });
    const allowed = TYPES[file.type];
    if (!allowed) return NextResponse.json({ success: false, error: "Chỉ hỗ trợ MP4, MOV, WebM, MP3, WAV hoặc M4A" }, { status: 400 });
    const max = allowed.type === "video" ? MAX_VIDEO_BYTES : MAX_AUDIO_BYTES;
    if (file.size > max) return NextResponse.json({ success: false, error: `File vượt giới hạn ${Math.round(max / 1024 / 1024)}MB` }, { status: 413 });
    const extension = path.extname(file.name).slice(1).toLowerCase();
    if (!allowed.extensions.includes(extension)) return NextResponse.json({ success: false, error: "Phần mở rộng không khớp loại file" }, { status: 400 });
    if (["source_video", "broll"].includes(purpose) && allowed.type !== "video") throw new Error("Mục đích này yêu cầu file video");
    if (["source_audio", "voice_sample", "music"].includes(purpose) && allowed.type !== "audio") throw new Error("Mục đích này yêu cầu file audio");
    const buffer = Buffer.from(await file.arrayBuffer());
    assertMediaSignature(buffer, file.type);
    const probe = await probeMediaBuffer(buffer, extension);
    const stored = await saveMedia({ folder: `video-studio/${allowed.type}`, buffer, extension });
    storedKey = stored.key;
    const checksum = mediaChecksum(buffer);
    const asset = await prisma.$transaction(async (tx) => {
      const created = await tx.videoAsset.create({
        data: {
          projectId, sceneId, type: purpose, source: "upload", name: path.basename(file.name).slice(0, 180),
          url: stored.url, storageKey: stored.key, mimeType: file.type, sizeBytes: file.size,
          checksum, status: "ready", validatedAt: new Date(), metadata: JSON.stringify(probe),
        },
      });
      if (scene && purpose === "source_video") {
        const revision = scene.inputRevision + 1;
        await tx.videoScene.update({ where: { id: scene.id }, data: {
          sourceVideoUrl: stored.url, generatedVideoUrl: null, lipSyncVideoUrl: null,
          inputRevision: revision, videoRevision: revision, lipSyncRevision: null,
          status: scene.kind === "talking" ? "voice_ready" : "video_ready", qaScore: null, qaReport: null,
        } });
      }
      if (scene && purpose === "source_audio") {
        const revision = scene.inputRevision + 1;
        await tx.videoScene.update({ where: { id: scene.id }, data: {
          audioUrl: stored.url, lipSyncVideoUrl: null, inputRevision: revision,
          audioRevision: revision, lipSyncRevision: null, status: "voice_ready", qaScore: null, qaReport: null,
        } });
      }
      if (scene && ["source_video", "source_audio"].includes(purpose)) {
        await tx.videoProject.update({ where: { id: projectId }, data: {
          inputRevision: { increment: 1 }, outputUrl: null, outputStorageKey: null, renderedRevision: null,
          qualityScore: null, qualityReport: null, approvalStatus: "draft", approvedRevision: null,
          approvedAt: null, approvedBy: null, status: "storyboard",
        } });
      }
      if (purpose === "music") {
        await tx.videoProject.update({ where: { id: projectId }, data: {
          inputRevision: { increment: 1 }, outputUrl: null, outputStorageKey: null, renderedRevision: null,
          qualityScore: null, qualityReport: null, approvalStatus: "draft", approvedRevision: null,
          approvedAt: null, approvedBy: null, status: "storyboard",
        } });
      }
      return created;
    });
    return NextResponse.json({ success: true, data: asset }, { status: 201 });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    if (storedKey) await deleteMedia(storedKey).catch(() => null);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: error instanceof z.ZodError ? 400 : 500 });
  }
}
