import "server-only";

import { getVideoProviderConfig, requireProviderKey } from "../config";
import { normalizeProviderStatus, providerFetch } from "../http";
import type { ProviderTask } from "../types";

export async function createLipSyncTask(input: { visualUrl: string; audioUrl: string }): Promise<ProviderTask> {
  const config = await getVideoProviderConfig();
  if (config.mockMode) {
    return { externalId: `mock-sync-${crypto.randomUUID()}`, status: "completed", progress: 100, outputUrl: input.visualUrl, raw: { mock: true } };
  }
  const apiKey = requireProviderKey("Sync Labs", config.sync.apiKey);
  const visualType = /\.(png|jpe?g|webp)(\?|$)/i.test(input.visualUrl) ? "image" : "video";
  const response = await providerFetch(`${config.sync.baseUrl}/v2/generate`, {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.sync.model,
      input: [
        { type: visualType, url: input.visualUrl },
        { type: "audio", url: input.audioUrl },
      ],
    }),
  });
  const data = await response.json() as { id?: string; status?: string };
  if (!data.id) throw new Error("Sync Labs không trả về generation ID");
  return { externalId: data.id, status: normalizeProviderStatus(data.status), progress: 5, raw: data };
}

export async function getLipSyncTask(externalId: string): Promise<ProviderTask> {
  const config = await getVideoProviderConfig();
  if (externalId.startsWith("mock-")) return { externalId, status: "completed", progress: 100, raw: { mock: true } };
  const apiKey = requireProviderKey("Sync Labs", config.sync.apiKey);
  const response = await providerFetch(`${config.sync.baseUrl}/v2/generate/${encodeURIComponent(externalId)}`, {
    headers: { "x-api-key": apiKey },
  });
  const data = await response.json() as { status?: string; outputUrl?: string; error?: string };
  return {
    externalId,
    status: normalizeProviderStatus(data.status),
    progress: normalizeProviderStatus(data.status) === "completed" ? 100 : 50,
    outputUrl: data.outputUrl,
    error: data.error,
    raw: data,
  };
}
