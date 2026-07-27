import { prisma } from "./db";
import { assertSafeAiProviderUrl } from "./provider-url-security";
import { decryptSecret } from "./secrets-crypto";

async function getSettings() {
  const settings = await prisma.settings.findFirst();
  const apiKey = decryptSecret(settings?.openaiApiKey);
  if (!settings || !apiKey) throw new Error("Chưa cấu hình OpenAI API Key");
  return {
    apiKey,
    baseURL: await assertSafeAiProviderUrl((settings.openaiBaseUrl || "https://api.openai.com/v1").replace(/\/$/, ""), "openai"),
    model: settings.imageModel || "dall-e-3",
    chatModel: settings.openaiChatModel || "gpt-5",
  };
}

/**
 * Chat completion via OpenAI-compatible API.
 * Mirrors signature of claude.ts generateContent so callers can swap.
 */
export async function generateChatCompletion(prompt: string, systemPrompt: string): Promise<string> {
  const { apiKey, baseURL, chatModel } = await getSettings();

  // If baseURL is a full endpoint, use as-is; else append /chat/completions
  const endpoint = baseURL.endsWith("/chat/completions")
    ? baseURL
    : `${baseURL}/chat/completions`;

  const body = {
    model: chatModel,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
    max_tokens: 1024,
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`OpenAI chat lỗi (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (typeof text !== "string") throw new Error("OpenAI không trả về text");
  return text;
}

const STANDARD_MODELS = ["dall-e-3", "dall-e-2"];

export type ImageFormat =
  | "feed"           // 1024x1024 square — FB feed
  | "cover"          // 1792x1024 landscape — FB cover, thumbnail
  | "story"          // 1024x1792 portrait — IG/FB Story, Reels
  | "thumbnail"      // 1792x1024 — video thumbnail
  | "zalo";          // 1024x1024 with safe area for caption overlay

const FORMAT_SIZE: Record<ImageFormat, string> = {
  feed: "1024x1024",
  cover: "1792x1024",
  story: "1024x1792",
  thumbnail: "1792x1024",
  zalo: "1024x1024",
};

const FORMAT_PROMPT_SUFFIX: Record<ImageFormat, string> = {
  feed: "",
  cover: "wide horizontal banner composition, landscape orientation, centered subject",
  story: "vertical portrait composition for mobile Story/Reels, leave bottom 30% relatively empty for text overlay",
  thumbnail: "thumbnail composition, large clear subject in center, high contrast, eye-catching",
  zalo: "centered subject with safe margins, suitable for caption overlay above and below",
};

export interface ImageReferenceInput {
  imageBase64?: string;
  imageUrl?: string;
  weight?: number;
}

export interface GenerateImageOptions {
  count?: number;
  references?: ImageReferenceInput[];
  referenceMode?: "identity" | "appearance" | "style";
  referenceStrength?: number;
}

export async function generateImage(prompt: string, format: ImageFormat = "feed"): Promise<string> {
  const images = await generateImages(prompt, format);
  return images[0];
}

export async function generateImages(
  prompt: string,
  format: ImageFormat = "feed",
  options: GenerateImageOptions = {},
): Promise<string[]> {
  const { apiKey, baseURL, model } = await getSettings();

  const isStandard = STANDARD_MODELS.includes(model);
  const size = FORMAT_SIZE[format];
  const suffix = FORMAT_PROMPT_SUFFIX[format];
  const finalPrompt = suffix ? `${prompt}. ${suffix}` : prompt;

  const references = (options.references ?? []).slice(0, 4);
  if (isStandard && references.length) {
    throw new Error(`${model} không hỗ trợ ảnh nhân viên tham chiếu; hãy chọn model image-edit qua AI Gateway`);
  }
  const body: Record<string, unknown> = {
    model,
    prompt: finalPrompt,
    n: Math.min(Math.max(options.count ?? 1, 1), 4),
    task_type: references.length ? "image-edit" : undefined,
    reference_mode: references.length ? options.referenceMode ?? "identity" : undefined,
    reference_strength: references.length ? Math.min(Math.max(options.referenceStrength ?? 0.82, 0), 1) : undefined,
    reference_images: references.length ? references.map((item) => ({
      image_base64: item.imageBase64,
      image_url: item.imageUrl,
      weight: item.weight,
    })) : undefined,
  };
  if (isStandard) {
    body.size = size;
    body.quality = "standard";
  } else {
    // Compatible APIs use "auto" params
    body.size = "auto";
    body.quality = "auto";
  }

  // Allow full endpoint URL (e.g. http://host/v1/images/generations) or base URL
  const endpoint = baseURL.endsWith("/images/generations")
    ? baseURL
    : `${baseURL}/images/generations`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`Lỗi API ảnh (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const images = (data.data ?? []).flatMap((item: { url?: string; b64_json?: string }) => {
    if (item.url) return [item.url];
    if (item.b64_json) return [`data:image/png;base64,${item.b64_json}`];
    return [];
  });
  if (images.length) return images;
  throw new Error("Không tạo được hình ảnh — API không trả về url hoặc b64_json");
}
