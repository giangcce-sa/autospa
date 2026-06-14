import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./db";

async function getClient() {
  const settings = await prisma.settings.findFirst();
  if (!settings?.claudeApiKey) throw new Error("Chưa cấu hình Claude API Key");

  return new Anthropic({
    apiKey: settings.claudeApiKey,
    baseURL: settings.claudeBaseUrl ?? "https://api.anthropic.com",
  });
}

export async function generateContent(prompt: string, systemPrompt: string): Promise<string> {
  const client = await getClient();
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: prompt }],
  });
  const block = response.content[0];
  if (block.type !== "text") throw new Error("Phản hồi không hợp lệ");
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
