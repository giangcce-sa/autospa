import "server-only";

import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { prisma } from "@/lib/db";
import { imageSourceToBuffer, readMedia, saveMedia, storageKeyFromMediaUrl } from "@/lib/media-storage";
import { getVideoProviderConfig } from "./config";
import { runFfmpeg } from "./ffmpeg";
import { parseJson } from "./types";
import { fetchSafeMedia } from "./media-security";

async function sourceBuffer(url: string, kind: "video" | "audio") {
  const storageKey = storageKeyFromMediaUrl(url);
  if (storageKey) {
    const buffer = await readMedia(storageKey);
    const max = kind === "video" ? 500 * 1024 * 1024 : 80 * 1024 * 1024;
    if (buffer.length > max) throw new Error("Media nội bộ vượt giới hạn render");
    return buffer;
  }
  if (url.startsWith("mock://")) throw new Error("Mock asset không thể render thành video thật");
  return fetchSafeMedia(url, {
    maxBytes: kind === "video" ? 500 * 1024 * 1024 : 80 * 1024 * 1024,
    allowedTypes: kind === "video" ? ["video/mp4", "video/quicktime", "video/webm"] : ["audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav"],
  });
}

async function sourceImageBuffer(url: string) {
  const storageKey = storageKeyFromMediaUrl(url);
  const buffer = storageKey
    ? await readMedia(storageKey)
    : url.startsWith("/uploads/") || url.startsWith("data:")
      ? await imageSourceToBuffer(url)
      : await fetchSafeMedia(url, { maxBytes: 15 * 1024 * 1024, allowedTypes: ["image/png", "image/jpeg", "image/webp"] });
  if (buffer.length > 15 * 1024 * 1024) throw new Error("Logo thương hiệu vượt giới hạn 15MB");
  return buffer;
}

function dimensions(aspectRatio: string) {
  if (aspectRatio === "9:16") return { width: 720, height: 1280 };
  if (aspectRatio === "1:1") return { width: 1080, height: 1080 };
  return { width: 1280, height: 720 };
}

function srtTime(seconds: number) {
  const value = Math.max(0, seconds);
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const secs = Math.floor(value % 60);
  const ms = Math.round((value - Math.floor(value)) * 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

function alignmentToSrt(value: string) {
  const words = parseJson<Array<{ text: string; start: number; end: number }>>(value, []);
  const chunks: Array<{ text: string; start: number; end: number }> = [];
  for (let index = 0; index < words.length; index += 7) {
    const group = words.slice(index, index + 7);
    if (!group.length) continue;
    chunks.push({ text: group.map((item) => item.text).join(" "), start: group[0].start, end: group[group.length - 1].end });
  }
  return chunks.map((item, index) => `${index + 1}\n${srtTime(item.start)} --> ${srtTime(item.end)}\n${item.text}\n`).join("\n");
}

function subtitleFilter(file: string) {
  const escaped = file.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
  return `subtitles='${escaped}':force_style='FontName=Arial,FontSize=18,PrimaryColour=&H00FFFFFF,OutlineColour=&H90000000,BorderStyle=3,Outline=1,Shadow=0,MarginV=46,Alignment=2'`;
}

export async function renderVideoProject(projectId: string) {
  const [project, config] = await Promise.all([
    prisma.videoProject.findUnique({ where: { id: projectId }, include: { scenes: { orderBy: { position: "asc" } }, assets: { where: { type: "music", status: "ready" }, orderBy: { createdAt: "desc" }, take: 1 } } }),
    getVideoProviderConfig(),
  ]);
  if (!project) throw new Error("Không tìm thấy dự án");
  if (!project.scenes.length) throw new Error("Dự án chưa có cảnh để render");
  if (config.mockMode) {
    const outputUrl = `mock://render/${projectId}`;
    await saveVersion(projectId, outputUrl, null);
    await prisma.videoProject.update({ where: { id: projectId }, data: { outputUrl, renderedRevision: project.inputRevision, status: "review", approvalStatus: "pending" } });
    return { outputUrl, mock: true };
  }

  const workdir = await mkdtemp(path.join(tmpdir(), "autospa-video-"));
  try {
    const { width, height } = dimensions(project.aspectRatio);
    const normalized: string[] = [];
    for (const [index, scene] of project.scenes.entries()) {
      const videoUrl = scene.lipSyncVideoUrl || scene.generatedVideoUrl || scene.sourceVideoUrl;
      if (!videoUrl) throw new Error(`Cảnh ${scene.position + 1} chưa có video`);
      const inputPath = path.join(workdir, `input-${index}.mp4`);
      const outputPath = path.join(workdir, `scene-${index}.mp4`);
      await writeFile(inputPath, await sourceBuffer(videoUrl, "video"));
      const audioUrl = scene.kind === "talking" ? null : scene.audioUrl;
      const audioPath = audioUrl ? path.join(workdir, `audio-${index}.mp3`) : null;
      if (audioUrl && audioPath) await writeFile(audioPath, await sourceBuffer(audioUrl, "audio"));

      const args = ["-y", "-stream_loop", "-1", "-i", inputPath];
      if (audioPath) args.push("-i", audioPath);
      else args.push("-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100");
      const filters = [`scale=${width}:${height}:force_original_aspect_ratio=decrease`, `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`, "fps=30"];
      const srt = alignmentToSrt(scene.subtitleData);
      if (srt) {
        const subtitlePath = path.join(workdir, `subtitle-${index}.srt`);
        await writeFile(subtitlePath, srt);
        filters.push(subtitleFilter(subtitlePath));
      }
      args.push(
        "-t", String(scene.durationSec),
        "-vf", filters.join(","),
        "-map", "0:v:0", "-map", "1:a:0", "-c:v", "libx264", "-preset", "medium", "-crf", "21",
        "-c:a", "aac", "-b:a", "160k", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-shortest", outputPath,
      );
      await runFfmpeg(args);
      normalized.push(outputPath);
    }

    const concatPath = path.join(workdir, "concat.txt");
    await writeFile(concatPath, normalized.map((file) => `file '${file.replace(/'/g, "'\\''")}'`).join("\n"));
    const concatOutput = path.join(workdir, "concat.mp4");
    await runFfmpeg(["-y", "-f", "concat", "-safe", "0", "-i", concatPath, "-c", "copy", "-movflags", "+faststart", concatOutput]);
    let currentOutput = concatOutput;

    const brand = await prisma.brandKit.findFirst({ where: { facebookPageId: project.facebookPageId }, select: { logoUrl: true } });
    if (brand?.logoUrl) {
      const logoPath = path.join(workdir, "brand-logo");
      const brandedPath = path.join(workdir, "branded.mp4");
      await writeFile(logoPath, await sourceImageBuffer(brand.logoUrl));
      await runFfmpeg([
        "-y", "-i", currentOutput, "-i", logoPath,
        "-filter_complex", "[1:v]scale='min(180,iw)':-1[logo];[0:v][logo]overlay=W-w-24:24:format=auto[v]",
        "-map", "[v]", "-map", "0:a?", "-c:v", "libx264", "-preset", "medium", "-crf", "21", "-c:a", "copy", "-pix_fmt", "yuv420p", "-movflags", "+faststart", brandedPath,
      ]);
      currentOutput = brandedPath;
    }

    const music = project.assets[0];
    if (music) {
      const musicPath = path.join(workdir, "music-input");
      const mixedPath = path.join(workdir, "mixed.mp4");
      await writeFile(musicPath, await sourceBuffer(music.url, "audio"));
      await runFfmpeg([
        "-y", "-i", currentOutput, "-stream_loop", "-1", "-i", musicPath,
        "-filter_complex", "[0:a]volume=1[a0];[1:a]volume=0.12[a1];[a0][a1]amix=inputs=2:duration=first:dropout_transition=2[a]",
        "-map", "0:v:0", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", "-shortest", mixedPath,
      ]);
      currentOutput = mixedPath;
    }

    const rendered = await readFile(currentOutput);
    const stored = await saveMedia({ folder: "video-studio/renders", buffer: rendered, extension: "mp4" });
    await saveVersion(projectId, stored.url, stored.key);
    await prisma.videoProject.update({
      where: { id: projectId },
      data: { outputUrl: stored.url, outputStorageKey: stored.key, renderedRevision: project.inputRevision, status: "review", approvalStatus: "pending" },
    });
    return { outputUrl: stored.url, storageKey: stored.key, mock: false };
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}

async function saveVersion(projectId: string, outputUrl: string, storageKey: string | null) {
  const [project, latest] = await Promise.all([
    prisma.videoProject.findUnique({ where: { id: projectId }, include: { scenes: { orderBy: { position: "asc" } } } }),
    prisma.videoVersion.findFirst({ where: { projectId }, orderBy: { version: "desc" }, select: { version: true } }),
  ]);
  if (!project) return;
  await prisma.videoVersion.create({
    data: {
      projectId,
      version: (latest?.version || 0) + 1,
      label: `Bản ${(latest?.version || 0) + 1}`,
      snapshot: JSON.stringify({ project, scenes: project.scenes }),
      outputUrl,
      storageKey,
      inputRevision: project.inputRevision,
    },
  });
}
