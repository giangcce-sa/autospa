import "server-only";

import { getVideoProviderConfig, requireProviderKey } from "../config";
import { normalizeProviderStatus, providerFetch } from "../http";
import type { ProviderTask } from "../types";

interface GenerateRunwayInput {
  prompt: string;
  imageUrl?: string;
  ratio: string;
  durationSec: number;
}

function runwayRatio(ratio: string) {
  if (ratio === "9:16") return "720:1280";
  if (ratio === "1:1") return "960:960";
  return "1280:720";
}

export async function createRunwayTask(input: GenerateRunwayInput): Promise<ProviderTask> {
  const config = await getVideoProviderConfig();
  if (config.mockMode) {
    return { externalId: `mock-runway-${crypto.randomUUID()}`, status: "completed", progress: 100, raw: { mock: true } };
  }
  const apiKey = requireProviderKey("Runway", config.runway.apiKey);
  const imageToVideo = Boolean(input.imageUrl);
  const response = await providerFetch(`${config.runway.baseUrl}/v1/${imageToVideo ? "image_to_video" : "text_to_video"}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Runway-Version": "2024-11-06",
    },
    body: JSON.stringify({
      model: config.runway.model,
      promptText: input.prompt,
      ...(input.imageUrl ? { promptImage: input.imageUrl } : {}),
      ratio: runwayRatio(input.ratio),
      duration: Math.min(Math.max(input.durationSec, 2), 10),
    }),
  });
  const data = await response.json() as { id?: string };
  if (!data.id) throw new Error("Runway không trả về task ID");
  return { externalId: data.id, status: "queued", progress: 5, raw: data };
}

export async function getRunwayTask(externalId: string): Promise<ProviderTask> {
  const config = await getVideoProviderConfig();
  if (externalId.startsWith("mock-")) return { externalId, status: "completed", progress: 100, raw: { mock: true } };
  const apiKey = requireProviderKey("Runway", config.runway.apiKey);
  const response = await providerFetch(`${config.runway.baseUrl}/v1/tasks/${encodeURIComponent(externalId)}`, {
    headers: { Authorization: `Bearer ${apiKey}`, "X-Runway-Version": "2024-11-06" },
  });
  const data = await response.json() as { status?: string; output?: string[]; failure?: string; progress?: number };
  return {
    externalId,
    status: normalizeProviderStatus(data.status),
    progress: data.progress ? Math.round(data.progress * 100) : undefined,
    outputUrl: data.output?.[0],
    error: data.failure,
    raw: data,
  };
}
