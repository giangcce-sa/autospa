import OpenAI from "openai";
import { prisma } from "./db";

async function getClient() {
  const settings = await prisma.settings.findFirst();
  if (!settings?.openaiApiKey) throw new Error("Chưa cấu hình OpenAI API Key");
  return {
    client: new OpenAI({
      apiKey: settings.openaiApiKey,
      baseURL: settings.openaiBaseUrl || "https://api.openai.com/v1",
    }),
    model: settings.imageModel || "dall-e-3",
  };
}

export async function generateImage(prompt: string): Promise<string> {
  const { client, model } = await getClient();
  const response = await client.images.generate({
    model,
    prompt,
    n: 1,
    size: "1024x1024",
    quality: "standard",
  });
  const url = response.data?.[0]?.url;
  if (!url) throw new Error("Không tạo được hình ảnh");
  return url;
}
