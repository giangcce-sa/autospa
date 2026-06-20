import { prisma } from "./db";

const ANTHROPIC_BASE_URL = "https://api.anthropic.com";
const DIRECT_CLAUDE_MODEL = "claude-sonnet-4-6";
const GATEWAY_CLAUDE_MODEL = "spa-assistant";

type AnthropicMessageResponse = {
  content?: Array<{ type: string; text?: string }>;
};

type OpenAiCompatibleResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

function normalizeBaseUrl(url: string) {
  return url.replace(/\/$/, "");
}

function isAnthropicBaseUrl(url: string) {
  return normalizeBaseUrl(url).includes("anthropic.com");
}

async function getSettings() {
  const settings = await prisma.settings.findFirst();
  if (!settings?.claudeApiKey) throw new Error("Chưa cấu hình Claude API Key");

  return {
    apiKey: settings.claudeApiKey,
    baseURL: normalizeBaseUrl(settings.claudeBaseUrl || ANTHROPIC_BASE_URL),
  };
}

export async function generateContent(prompt: string, systemPrompt: string): Promise<string> {
  const { apiKey, baseURL } = await getSettings();

  if (!isAnthropicBaseUrl(baseURL)) {
    const endpoint = baseURL.endsWith("/chat/completions")
      ? baseURL
      : `${baseURL}/chat/completions`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GATEWAY_CLAUDE_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        max_tokens: 1024,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => `HTTP ${res.status}`);
      throw new Error(`Claude gateway lỗi (${res.status}): ${text.slice(0, 200)}`);
    }

    const data = (await res.json()) as OpenAiCompatibleResponse;
    const text = data.choices?.[0]?.message?.content;
    if (typeof text !== "string") throw new Error("Claude gateway không trả về text");
    return text;
  }

  const res = await fetch(`${baseURL}/v1/messages`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: DIRECT_CLAUDE_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`Claude API lỗi (${res.status}): ${text.slice(0, 200)}`);
  }

  const response = (await res.json()) as AnthropicMessageResponse;
  const block = response.content?.[0];
  if (block?.type !== "text" || typeof block.text !== "string") {
    throw new Error("Phản hồi không hợp lệ");
  }
  return block.text;
}

export async function getBrandContext(): Promise<string> {
  const items = await prisma.brandKnowledge.findMany();
  if (!items.length) return "";
  return items.map((i: { category: string; title: string; content: string }) => `[${i.category}] ${i.title}: ${i.content}`).join("\n");
}

export async function getStyleProfile(facebookPageId?: string): Promise<string> {
  const profile = await prisma.styleProfile.findFirst({
    where: facebookPageId ? { facebookPageId } : undefined,
  });
  return profile?.profile ?? "";
}

export async function getStyleSamples(limit = 5, facebookPageId?: string): Promise<string> {
  const samples = await prisma.styleSample.findMany({
    where: facebookPageId ? { facebookPageId } : undefined,
    orderBy: [{ likes: "desc" }, { comments: "desc" }],
    take: limit,
  });
  if (!samples.length) return "";
  return samples.map((s: { content: string }, i: number) => `Mẫu ${i + 1}:\n${s.content}`).join("\n\n---\n\n");
}
