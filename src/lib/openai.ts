import { prisma } from "./db";

async function getSettings() {
  const settings = await prisma.settings.findFirst();
  if (!settings?.openaiApiKey) throw new Error("Chưa cấu hình OpenAI API Key");
  return {
    apiKey: settings.openaiApiKey,
    baseURL: (settings.openaiBaseUrl || "https://api.openai.com/v1").replace(/\/$/, ""),
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

export async function generateImage(prompt: string, format: ImageFormat = "feed"): Promise<string> {
  const { apiKey, baseURL, model } = await getSettings();

  const isStandard = STANDARD_MODELS.includes(model);
  const size = FORMAT_SIZE[format];
  const suffix = FORMAT_PROMPT_SUFFIX[format];
  const finalPrompt = suffix ? `${prompt}. ${suffix}` : prompt;

  const body: Record<string, unknown> = { model, prompt: finalPrompt, n: 1 };
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
  });

  if (!res.ok) {
    const text = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`Lỗi API ảnh (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const item = data.data?.[0];
  const url = item?.url;
  if (url) return url;

  // Some providers return b64_json instead of url
  const b64 = item?.b64_json;
  if (b64) return `data:image/png;base64,${b64}`;

  throw new Error("Không tạo được hình ảnh — API không trả về url hoặc b64_json");
}
