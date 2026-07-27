import "server-only";

import { mkdtemp, readFile, readdir, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { assertSafeAiProviderUrl } from "@/lib/provider-url-security";
import { decryptSecret } from "@/lib/secrets-crypto";
import { readMedia, storageKeyFromMediaUrl } from "@/lib/media-storage";
import { generateChatCompletion } from "@/lib/openai";
import { analyzeGeneratedImage } from "@/lib/image-vision";
import { getVideoProviderConfig } from "./config";
import { providerFetch } from "./http";
import { runFfmpeg } from "./ffmpeg";

interface LearnedSkill { name: string; group: string; description: string; rules: string[]; confidence: number }

function fallbackSkills(): LearnedSkill[] {
  return [
    { name: "Mở đầu trực diện", group: "content", description: "Đi thẳng vào vấn đề khách hàng quan tâm trong những giây đầu.", rules: ["Hook ngắn", "Không dùng claim tuyệt đối"], confidence: 0.62 },
    { name: "Nhịp dựng quy trình thật", group: "editing", description: "Đan xen cảnh tư vấn và thao tác thật để duy trì độ tin cậy.", rules: ["Cảnh 3-7 giây", "Ưu tiên thao tác thật"], confidence: 0.58 },
    { name: "Hình ảnh spa tự nhiên", group: "visual", description: "Ánh sáng sạch, chuyển động máy nhẹ và màu da tự nhiên.", rules: ["Không làm da nhựa", "Giữ không gian thật"], confidence: 0.56 },
  ];
}

function parseSkills(value: string): LearnedSkill[] {
  const source = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || value.slice(value.indexOf("["), value.lastIndexOf("]") + 1);
  const parsed = JSON.parse(source) as LearnedSkill[];
  if (!Array.isArray(parsed)) throw new Error("AI không trả về danh sách skill");
  const groups = new Set(["content", "voice", "visual", "editing", "identity", "performance"]);
  return parsed.filter((item) => item.name && groups.has(item.group) && item.description && Array.isArray(item.rules) && Number.isFinite(item.confidence)).slice(0, 12);
}

async function transcribeAudio(buffer: Buffer) {
  const settings = await prisma.settings.findFirst({ select: { openaiApiKey: true, openaiBaseUrl: true } });
  const transcriptionKey = decryptSecret(settings?.openaiApiKey);
  if (!settings || !transcriptionKey) return "";
  const baseUrl = await assertSafeAiProviderUrl(
    (settings.openaiBaseUrl || "https://api.openai.com/v1").replace(/\/(chat\/completions|images\/generations)\/?$/, "").replace(/\/$/, ""),
    "openai",
  );
  const response = await providerFetch(`${baseUrl}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${transcriptionKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "auto", audio_base64: buffer.toString("base64"), language: "vi", response_format: "verbose_json", metadata: { app: "autospa", feature: "video-learning" } }),
  }, 180_000);
  const data = await response.json() as { text?: string; transcript?: string };
  return data.text || data.transcript || "";
}

export async function analyzeSourceVideo(input: { assetId: string; projectId: string; facebookPageId?: string | null }) {
  const [asset, config] = await Promise.all([
    prisma.videoAsset.findUnique({ where: { id: input.assetId } }),
    getVideoProviderConfig(),
  ]);
  if (!asset || asset.projectId !== input.projectId || asset.type !== "source_video") throw new Error("Không tìm thấy video nguồn");
  const key = asset.storageKey || storageKeyFromMediaUrl(asset.url);
  if (!key) throw new Error("Video học phải được upload vào media storage");
  const workdir = await mkdtemp(path.join(tmpdir(), "autospa-learning-"));
  try {
    const inputPath = path.join(workdir, "source.mp4");
    const audioPath = path.join(workdir, "audio.mp3");
    await writeFile(inputPath, await readMedia(key));
    await runFfmpeg(["-y", "-i", inputPath, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "48k", "-t", "180", audioPath]);
    const transcript = config.mockMode ? "" : await transcribeAudio(await readFile(audioPath)).catch(() => "");
    const visualObservations: string[] = [];
    if (!config.mockMode) {
      await runFfmpeg(["-y", "-i", inputPath, "-vf", "fps=1/12,scale=960:-2", "-frames:v", "6", path.join(workdir, "frame-%02d.jpg")]).catch(() => null);
      const frames = (await readdir(workdir)).filter((name) => name.startsWith("frame-") && name.endsWith(".jpg")).sort().slice(0, 6);
      for (const frame of frames) {
        const buffer = await readFile(path.join(workdir, frame));
        const result = await analyzeGeneratedImage({
          imageUrl: `data:image/jpeg;base64,${buffer.toString("base64")}`,
          prompt: "Keyframe từ video thật của spa; mô tả bố cục, ánh sáng, nhân vật, không gian, tính chân thực và vùng an toàn.",
          format: "video-keyframe",
        }).catch(() => null);
        if (result) visualObservations.push(`${result.summary}; realism=${result.dimensions.realism}; layout=${result.dimensions.layout}; ${result.issues.map((issue) => issue.message).join(", ")}`);
      }
    }
    let skills: LearnedSkill[];
    if (config.mockMode) {
      skills = fallbackSkills();
    } else {
      if (!transcript.trim() && !visualObservations.length) throw new Error("INSUFFICIENT_EVIDENCE: không trích xuất được transcript hoặc keyframe");
      const response = await generateChatCompletion(
        `Phân tích video thật của spa từ transcript, keyframe và metadata sau. Transcript: ${transcript.slice(0, 16000)}. Keyframe: ${visualObservations.join(" | ").slice(0, 8000)}. Metadata: ${asset.metadata}.`,
        `Trích xuất skill có thể tái sử dụng nhưng không sao chép nguyên văn. Trả về JSON array [{name,group:"content"|"voice"|"visual"|"editing"|"identity"|"performance",description,rules:string[],confidence:0..1}]. Chỉ đưa ra quan sát có căn cứ; identity không được tự động kích hoạt.`,
      );
      skills = parseSkills(response);
      if (!skills.length) throw new Error("INSUFFICIENT_EVIDENCE: AI không trả về skill có căn cứ");
    }
    for (const skill of skills) {
      const confidence = Math.min(Math.max(skill.confidence, 0), 1);
      const evidenceHash = createHash("sha256").update(JSON.stringify({ group: skill.group, name: skill.name.toLowerCase(), rules: [...skill.rules].sort() })).digest("hex");
      const evidenceItem = { assetId: input.assetId, transcript: transcript.slice(0, 2400), visual: visualObservations.slice(0, 6), mock: config.mockMode };
      const existing = await prisma.videoSkill.findFirst({ where: { facebookPageId: input.facebookPageId || null, evidenceHash, status: { in: ["pending", "approved"] } } });
      if (existing) {
        const oldEvidence = JSON.parse(existing.evidence) as unknown[];
        const sampleCount = existing.sampleCount + 1;
        await prisma.videoSkill.update({ where: { id: existing.id }, data: {
          sampleCount,
          confidence: ((existing.confidence * existing.sampleCount) + confidence) / sampleCount,
          evidence: JSON.stringify([...oldEvidence, evidenceItem].slice(-20)),
          updatedAt: new Date(),
        } });
      } else {
        await prisma.videoSkill.create({ data: {
          facebookPageId: input.facebookPageId || null, sourceProjectId: input.projectId, sourceAssetId: input.assetId,
          name: skill.name, group: skill.group, description: skill.description, rules: JSON.stringify(skill.rules),
          evidence: JSON.stringify([evidenceItem]), evidenceHash, confidence, status: "pending",
        } });
      }
    }
    const oldMetadata = JSON.parse(asset.metadata || "{}") as Record<string, unknown>;
    await prisma.videoAsset.update({ where: { id: asset.id }, data: { metadata: JSON.stringify({ ...oldMetadata, learning: { transcript: transcript.slice(0, 16000), visualObservations, analyzedAt: new Date().toISOString(), mock: config.mockMode } }) } });
    return { transcript, visualObservations, skills };
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}

export async function approveVideoSkill(skillId: string, userId?: string) {
  const skill = await prisma.videoSkill.findUnique({ where: { id: skillId } });
  if (!skill) throw new Error("Không tìm thấy skill");
  const domainMap: Record<string, string> = { content: "content", voice: "brand", visual: "brand", editing: "content", identity: "brand", performance: "ads" };
  const brainSkill = await prisma.brainSkill.create({
    data: {
      name: skill.name,
      description: skill.description,
      domain: domainMap[skill.group] || "content",
      category: `video_${skill.group}`,
      tags: JSON.stringify(["video", skill.group]),
      inputSignals: JSON.stringify(["video_brief", "video_style"]),
      playbook: skill.rules,
      tools: JSON.stringify(["video-studio"]),
      successMetric: "video_completion_rate",
      permissionLevel: "suggest",
      riskLevel: skill.group === "identity" || skill.group === "voice" ? "high" : "medium",
      confidence: skill.confidence,
      classificationConfidence: skill.confidence,
      status: "active",
      learnedFrom: "video_real",
    },
  });
  return prisma.videoSkill.update({ where: { id: skillId }, data: { status: "approved", approvedAt: new Date(), approvedBy: userId, brainSkillId: brainSkill.id } });
}
