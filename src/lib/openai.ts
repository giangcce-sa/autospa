import { prisma } from "./db";

async function getSettings() {
  const settings = await prisma.settings.findFirst();
  if (!settings?.openaiApiKey) throw new Error("Chưa cấu hình OpenAI API Key");
  return {
    apiKey: settings.openaiApiKey,
    baseURL: (settings.openaiBaseUrl || "https://api.openai.com/v1").replace(/\/$/, ""),
    model: settings.imageModel || "dall-e-3",
  };
}

const STANDARD_MODELS = ["dall-e-3", "dall-e-2"];

export async function generateImage(prompt: string): Promise<string> {
  const { apiKey, baseURL, model } = await getSettings();

  const isStandard = STANDARD_MODELS.includes(model);

  const body: Record<string, unknown> = { model, prompt, n: 1 };
  if (isStandard) {
    body.size = "1024x1024";
    body.quality = "standard";
  } else {
    // Compatible APIs (9router cx/gpt-5.5-image, etc.) use "auto" params
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
