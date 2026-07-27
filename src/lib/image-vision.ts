import "server-only";

import sharp from "sharp";
import { prisma } from "@/lib/db";
import { assertSafeAiProviderUrl } from "@/lib/provider-url-security";
import { decryptSecret } from "@/lib/secrets-crypto";
import { imageSourceToBuffer } from "@/lib/media-storage";

export interface ImageVisionResult {
  score: number;
  passed: boolean;
  summary: string;
  issues: Array<{ type: string; severity: "low" | "medium" | "high"; message: string }>;
  dimensions: {
    anatomy: number;
    identity: number;
    serviceFit: number;
    brandFit: number;
    realism: number;
    layout: number;
    safety: number;
  };
}

const DEFAULT_DIMENSIONS = {
  anatomy: 70,
  identity: 70,
  serviceFit: 70,
  brandFit: 70,
  realism: 70,
  layout: 70,
  safety: 70,
};

function clampScore(value: unknown, fallback = 70) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.min(Math.max(Math.round(number), 0), 100) : fallback;
}

function parseJsonObject(text: string) {
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Vision không trả về JSON hợp lệ");
  return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
}

async function normalizedBase64(source: string) {
  const buffer = await imageSourceToBuffer(source);
  return sharp(buffer)
    .rotate()
    .resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer()
    .then((output) => output.toString("base64"));
}

export async function analyzeGeneratedImage(input: {
  imageUrl: string;
  prompt: string;
  serviceName?: string | null;
  brandName?: string | null;
  format: string;
  staffDescriptor?: string | null;
  referenceBase64?: string[];
}): Promise<ImageVisionResult> {
  const settings = await prisma.settings.findFirst({
    select: { openaiApiKey: true, openaiBaseUrl: true },
  });
  const visionApiKey = decryptSecret(settings?.openaiApiKey);
  if (!settings || !visionApiKey) throw new Error("Chưa cấu hình API key cho Vision");

  const imageBase64 = await normalizedBase64(input.imageUrl);
  const baseUrl = await assertSafeAiProviderUrl((settings.openaiBaseUrl || "https://api.openai.com/v1")
    .replace(/\/(images\/generations|chat\/completions|vision\/analyze)\/?$/, "")
    .replace(/\/$/, ""), "openai");
  const prompt = `Bạn là QA hình ảnh quảng cáo spa. Hãy kiểm tra ẢNH ĐẦU TIÊN là ảnh vừa sinh.${
    input.referenceBase64?.length ? " Các ảnh tiếp theo là ảnh nhân viên tham chiếu để so sánh nhận diện." : ""
  }

Dịch vụ: ${input.serviceName || "không chỉ định"}
Thương hiệu: ${input.brandName || "không chỉ định"}
Định dạng: ${input.format}
Mô tả nhân viên: ${input.staffDescriptor || "không dùng nhân viên mẫu"}
Prompt đã dùng: ${input.prompt.slice(0, 1800)}

Chấm 0-100 cho anatomy, identity, serviceFit, brandFit, realism, layout, safety. Identity chỉ chấm thấp khi có ảnh tham chiếu mà khuôn mặt/độ tuổi/tóc khác rõ rệt. Phát hiện tay/ngón dư, mặt méo, da nhựa, thiết bị sai, chữ rác, watermark, logo giả, bố cục thiếu vùng an toàn và claim before-after. Trả về duy nhất JSON:
{"score":0,"summary":"...","dimensions":{"anatomy":0,"identity":0,"serviceFit":0,"brandFit":0,"realism":0,"layout":0,"safety":0},"issues":[{"type":"...","severity":"low|medium|high","message":"..."}]}`;

  const response = await fetch(`${baseUrl}/vision/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${visionApiKey}`,
    },
    body: JSON.stringify({
      model: "auto",
      prompt,
      image_base64: imageBase64,
      reference_images: (input.referenceBase64 ?? []).slice(0, 3).map((value) => ({ image_base64: value })),
      max_tokens: 900,
      metadata: { app: "autospa", feature: "image-quality-check" },
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Vision QA lỗi (${response.status}): ${detail.slice(0, 180)}`);
  }

  const payload = await response.json() as { content?: string };
  const parsed = parseJsonObject(payload.content ?? "");
  const rawDimensions = (parsed.dimensions ?? {}) as Record<string, unknown>;
  const dimensions = {
    anatomy: clampScore(rawDimensions.anatomy, DEFAULT_DIMENSIONS.anatomy),
    identity: input.referenceBase64?.length ? clampScore(rawDimensions.identity, DEFAULT_DIMENSIONS.identity) : 100,
    serviceFit: clampScore(rawDimensions.serviceFit, DEFAULT_DIMENSIONS.serviceFit),
    brandFit: clampScore(rawDimensions.brandFit, DEFAULT_DIMENSIONS.brandFit),
    realism: clampScore(rawDimensions.realism, DEFAULT_DIMENSIONS.realism),
    layout: clampScore(rawDimensions.layout, DEFAULT_DIMENSIONS.layout),
    safety: clampScore(rawDimensions.safety, DEFAULT_DIMENSIONS.safety),
  };
  const computed = Math.round(Object.values(dimensions).reduce((sum, value) => sum + value, 0) / Object.keys(dimensions).length);
  const score = clampScore(parsed.score, computed);
  const issues = Array.isArray(parsed.issues)
    ? parsed.issues.slice(0, 8).map((issue) => {
        const item = issue as Record<string, unknown>;
        const severity: "low" | "medium" | "high" = item.severity === "high" || item.severity === "medium" ? item.severity : "low";
        return { type: String(item.type ?? "quality"), severity, message: String(item.message ?? "Cần kiểm tra ảnh") };
      })
    : [];

  return {
    score,
    passed: score >= 80 && dimensions.safety >= 75 && dimensions.anatomy >= 70,
    summary: String(parsed.summary ?? (score >= 80 ? "Ảnh đạt chuẩn" : "Ảnh cần xem lại")),
    issues,
    dimensions,
  };
}
