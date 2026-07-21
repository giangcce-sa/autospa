import { env } from "../config/env.js";
import { modelRoutes } from "../config/models.js";
import { GatewayError } from "../errors/gateway-error.js";
import type { AiProviderAdapter, GatewayChatRequest, GatewayChatResponse, GatewayModel } from "./types.js";

type NineRouterResponse = {
  id?: string;
  choices?: Array<{
    message?: {
      content?: string;
    };
    delta?: {
      content?: string;
    };
    text?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    input_tokens?: number;
    output_tokens?: number;
  };
  provider?: string;
  upstream_provider?: string;
  upstream_model?: string;
  fallback_used?: boolean;
};

type NineRouterModelsResponse = {
  data?: Array<{
    id?: string;
    object?: string;
    owned_by?: string;
  }>;
};

const nineRouterModelKinds = ["image", "tts", "stt", "embedding", "image-to-text", "web"] as const;

type NineRouterImageResponse = {
  created?: number;
  data?: Array<{
    url?: string;
    b64_json?: string;
    revised_prompt?: string;
  }>;
  provider?: string;
  upstream_provider?: string;
  upstream_model?: string;
};

type NineRouterEmbeddingResponse = {
  object?: string;
  data?: Array<{
    object?: string;
    embedding?: number[];
    index?: number;
  }>;
  model?: string;
  usage?: {
    prompt_tokens?: number;
    total_tokens?: number;
  };
  provider?: string;
  upstream_provider?: string;
  upstream_model?: string;
};

type NineRouterTranscriptionResponse = {
  text?: string;
  language?: string;
  duration?: number;
  provider?: string;
  upstream_provider?: string;
  upstream_model?: string;
};

type NineRouterBinaryResponse = {
  body: Buffer;
  contentType: string;
  latencyMs: number;
};

function extractContent(payload: NineRouterResponse): string | undefined {
  return payload.choices?.[0]?.message?.content ?? payload.choices?.[0]?.text;
}

function parseNineRouterChatPayload(raw: string): NineRouterResponse {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("data:")) {
    return JSON.parse(trimmed) as NineRouterResponse;
  }

  let id: string | undefined;
  let content = "";
  let usage: NineRouterResponse["usage"];
  let provider: string | undefined;
  let upstreamProvider: string | undefined;
  let upstreamModel: string | undefined;
  let fallbackUsed: boolean | undefined;

  for (const line of trimmed.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice("data:".length).trim();
    if (!data || data === "[DONE]") continue;

    const chunk = JSON.parse(data) as NineRouterResponse;
    id ??= chunk.id;
    usage ??= chunk.usage;
    provider ??= chunk.provider;
    upstreamProvider ??= chunk.upstream_provider;
    upstreamModel ??= chunk.upstream_model;
    fallbackUsed ??= chunk.fallback_used;
    content += chunk.choices?.[0]?.delta?.content ?? chunk.choices?.[0]?.message?.content ?? chunk.choices?.[0]?.text ?? "";
  }

  return {
    id,
    choices: [{ message: { content } }],
    usage,
    provider,
    upstream_provider: upstreamProvider,
    upstream_model: upstreamModel,
    fallback_used: fallbackUsed
  };
}

function nineRouterHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "content-type": "application/json"
  };

  if (env.NINEROUTER_API_KEY) {
    headers.authorization = `Bearer ${env.NINEROUTER_API_KEY}`;
  }

  return headers;
}

async function fetchNineRouterJson<T>(path: string, body: Record<string, unknown>, errorPrefix: string): Promise<{ payload: T; latencyMs: number }> {
  if (!env.NINEROUTER_BASE_URL) {
    throw new GatewayError("PROVIDER_NOT_CONFIGURED", "NINEROUTER_BASE_URL is not configured", 503);
  }

  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.NINEROUTER_TIMEOUT_SECONDS * 1000);

  try {
    const response = await fetch(`${env.NINEROUTER_BASE_URL.replace(/\/$/, "")}${path}`, {
      method: "POST",
      signal: controller.signal,
      headers: nineRouterHeaders(),
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new GatewayError("PROVIDER_ERROR", `${errorPrefix} returned ${response.status}`, response.status);
    }

    return { payload: (await response.json()) as T, latencyMs: Date.now() - started };
  } catch (error) {
    if (error instanceof GatewayError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new GatewayError("PROVIDER_TIMEOUT", `${errorPrefix} request timed out`, 504);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchNineRouterBinary(path: string, body: Record<string, unknown>, errorPrefix: string): Promise<NineRouterBinaryResponse> {
  if (!env.NINEROUTER_BASE_URL) {
    throw new GatewayError("PROVIDER_NOT_CONFIGURED", "NINEROUTER_BASE_URL is not configured", 503);
  }

  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.NINEROUTER_TIMEOUT_SECONDS * 1000);

  try {
    const response = await fetch(`${env.NINEROUTER_BASE_URL.replace(/\/$/, "")}${path}`, {
      method: "POST",
      signal: controller.signal,
      headers: nineRouterHeaders(),
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new GatewayError("PROVIDER_ERROR", `${errorPrefix} returned ${response.status}`, response.status);
    }

    return {
      body: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get("content-type") ?? "application/octet-stream",
      latencyMs: Date.now() - started
    };
  } catch (error) {
    if (error instanceof GatewayError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new GatewayError("PROVIDER_TIMEOUT", `${errorPrefix} request timed out`, 504);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchNineRouterText(path: string, body: Record<string, unknown>, errorPrefix: string): Promise<{ body: string; latencyMs: number }> {
  if (!env.NINEROUTER_BASE_URL) {
    throw new GatewayError("PROVIDER_NOT_CONFIGURED", "NINEROUTER_BASE_URL is not configured", 503);
  }

  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.NINEROUTER_TIMEOUT_SECONDS * 1000);

  try {
    const response = await fetch(`${env.NINEROUTER_BASE_URL.replace(/\/$/, "")}${path}`, {
      method: "POST",
      signal: controller.signal,
      headers: nineRouterHeaders(),
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new GatewayError("PROVIDER_ERROR", `${errorPrefix} returned ${response.status}`, response.status);
    }

    return { body: await response.text(), latencyMs: Date.now() - started };
  } catch (error) {
    if (error instanceof GatewayError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new GatewayError("PROVIDER_TIMEOUT", `${errorPrefix} request timed out`, 504);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export class NineRouterAdapter implements AiProviderAdapter {
  readonly provider = "9router" as const;

  async chat(request: GatewayChatRequest): Promise<GatewayChatResponse> {
    if (!env.NINEROUTER_BASE_URL) {
      throw new GatewayError("PROVIDER_NOT_CONFIGURED", "NINEROUTER_BASE_URL is not configured", 503);
    }

    const started = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.NINEROUTER_TIMEOUT_SECONDS * 1000);

    try {
      const response = await fetch(`${env.NINEROUTER_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: nineRouterHeaders(),
        body: JSON.stringify({
          model: request.providerModel,
          messages: request.messages,
          temperature: request.temperature,
          max_tokens: request.maxTokens,
          metadata: {
            ...request.metadata,
            gateway_request_id: request.requestId,
            client_id: request.clientId
          }
        })
      });

      if (!response.ok) {
        throw new GatewayError("PROVIDER_ERROR", `9router returned ${response.status}`, response.status);
      }

      const payload = parseNineRouterChatPayload(await response.text());
      const content = extractContent(payload);
      if (!content) {
        throw new GatewayError("PROVIDER_ERROR", "9router returned an empty response", 502);
      }

      return {
        id: request.requestId,
        model: request.model,
        provider: this.provider,
        content,
        usage: {
          input_tokens: payload.usage?.input_tokens ?? payload.usage?.prompt_tokens ?? null,
          output_tokens: payload.usage?.output_tokens ?? payload.usage?.completion_tokens ?? null,
          source: payload.usage ? "provider" : "unavailable"
        },
        latency_ms: Date.now() - started,
        provider_metadata: {
          provider_id: payload.id,
          upstream_provider: payload.upstream_provider ?? payload.provider,
          upstream_model: payload.upstream_model ?? request.providerModel,
          fallback_used: payload.fallback_used ?? false
        }
      };
    } catch (error) {
      if (error instanceof GatewayError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new GatewayError("PROVIDER_TIMEOUT", "9router request timed out", 504);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async listModels(): Promise<GatewayModel[]> {
    return modelRoutes
      .filter((route) => route.provider === this.provider)
      .map((route) => ({
        id: route.model,
        provider: route.provider,
        provider_model: route.providerModel
      }));
  }
}

export type NineRouterImageGenerationRequest = {
  requestId: string;
  clientId: string;
  model: string;
  providerModel: string;
  prompt: string;
  n?: number;
  size?: string;
  quality?: string;
  style?: string;
  responseFormat?: "url" | "b64_json";
  referenceMode?: "identity" | "appearance" | "style";
  referenceStrength?: number;
  referenceImages?: Array<{ image_url?: string; image_base64?: string; weight?: number }>;
  metadata?: Record<string, unknown>;
};

export async function generateNineRouterImage(request: NineRouterImageGenerationRequest): Promise<Record<string, unknown>> {
  if (!env.NINEROUTER_BASE_URL) {
    throw new GatewayError("PROVIDER_NOT_CONFIGURED", "NINEROUTER_BASE_URL is not configured", 503);
  }

  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.NINEROUTER_TIMEOUT_SECONDS * 1000);

  try {
    const response = await fetch(`${env.NINEROUTER_BASE_URL.replace(/\/$/, "")}/images/generations`, {
      method: "POST",
      signal: controller.signal,
      headers: nineRouterHeaders(),
      body: JSON.stringify({
        model: request.providerModel,
        prompt: request.prompt,
        n: request.n,
        size: request.size,
        quality: request.quality,
        style: request.style,
        response_format: request.responseFormat,
        task_type: request.referenceImages?.length ? "image-edit" : "image-generation",
        reference_mode: request.referenceMode,
        reference_strength: request.referenceStrength,
        reference_images: request.referenceImages?.map((item) => ({
          image_url: item.image_url,
          image_base64: item.image_base64,
          weight: item.weight
        })),
        metadata: {
          ...request.metadata,
          gateway_request_id: request.requestId,
          client_id: request.clientId
        }
      })
    });

    if (!response.ok) {
      throw new GatewayError("PROVIDER_ERROR", `9router image provider returned ${response.status}`, response.status);
    }

    const payload = (await response.json()) as NineRouterImageResponse;
    return {
      id: request.requestId,
      model: request.model,
      provider: "9router",
      created: payload.created ?? Math.floor(Date.now() / 1000),
      data: payload.data ?? [],
      latency_ms: Date.now() - started,
      provider_metadata: {
        upstream_provider: payload.upstream_provider ?? payload.provider,
        upstream_model: payload.upstream_model ?? request.providerModel
      }
    };
  } catch (error) {
    if (error instanceof GatewayError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new GatewayError("PROVIDER_TIMEOUT", "9router image request timed out", 504);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export type NineRouterEmbeddingRequest = {
  requestId: string;
  clientId: string;
  model: string;
  providerModel: string;
  input: string | string[];
  encodingFormat?: "float" | "base64";
  dimensions?: number;
  metadata?: Record<string, unknown>;
};

export async function createNineRouterEmbedding(request: NineRouterEmbeddingRequest): Promise<Record<string, unknown>> {
  const { payload, latencyMs } = await fetchNineRouterJson<NineRouterEmbeddingResponse>(
    "/embeddings",
    {
      model: request.providerModel,
      input: request.input,
      encoding_format: request.encodingFormat,
      dimensions: request.dimensions,
      metadata: {
        ...request.metadata,
        gateway_request_id: request.requestId,
        client_id: request.clientId
      }
    },
    "9router embeddings provider"
  );

  return {
    object: payload.object ?? "list",
    data: payload.data ?? [],
    model: request.model,
    usage: payload.usage ?? null,
    latency_ms: latencyMs,
    provider_metadata: {
      upstream_provider: payload.upstream_provider ?? payload.provider,
      upstream_model: payload.upstream_model ?? request.providerModel
    }
  };
}

export type NineRouterSpeechRequest = {
  requestId: string;
  clientId: string;
  model: string;
  providerModel: string;
  input: string;
  voice: string;
  responseFormat?: string;
  speed?: number;
  metadata?: Record<string, unknown>;
};

export async function createNineRouterSpeech(request: NineRouterSpeechRequest): Promise<NineRouterBinaryResponse> {
  return fetchNineRouterBinary(
    "/audio/speech",
    {
      model: request.providerModel,
      input: request.input,
      voice: request.voice,
      response_format: request.responseFormat,
      speed: request.speed,
      metadata: {
        ...request.metadata,
        gateway_request_id: request.requestId,
        client_id: request.clientId,
        gateway_model: request.model
      }
    },
    "9router speech provider"
  );
}

export type NineRouterTranscriptionRequest = {
  requestId: string;
  clientId: string;
  model: string;
  providerModel: string;
  fileUrl?: string;
  audioBase64?: string;
  language?: string;
  prompt?: string;
  responseFormat?: string;
  temperature?: number;
  metadata?: Record<string, unknown>;
};

export async function transcribeNineRouterAudio(request: NineRouterTranscriptionRequest): Promise<Record<string, unknown>> {
  const { payload, latencyMs } = await fetchNineRouterJson<NineRouterTranscriptionResponse>(
    "/audio/transcriptions",
    {
      model: request.providerModel,
      file_url: request.fileUrl,
      audio_base64: request.audioBase64,
      language: request.language,
      prompt: request.prompt,
      response_format: request.responseFormat,
      temperature: request.temperature,
      metadata: {
        ...request.metadata,
        gateway_request_id: request.requestId,
        client_id: request.clientId
      }
    },
    "9router transcription provider"
  );

  return {
    text: payload.text ?? "",
    language: payload.language,
    duration: payload.duration,
    model: request.model,
    latency_ms: latencyMs,
    provider_metadata: {
      upstream_provider: payload.upstream_provider ?? payload.provider,
      upstream_model: payload.upstream_model ?? request.providerModel
    }
  };
}

export type NineRouterVisionRequest = {
  requestId: string;
  clientId: string;
  model: string;
  providerModel: string;
  prompt: string;
  imageUrl?: string;
  imageBase64?: string;
  referenceImages?: Array<{ image_url?: string; image_base64?: string }>;
  maxTokens?: number;
  metadata?: Record<string, unknown>;
};

export async function analyzeNineRouterVision(request: NineRouterVisionRequest): Promise<Record<string, unknown>> {
  const imagePayload = request.imageUrl
    ? { type: "image_url", image_url: { url: request.imageUrl } }
    : { type: "image_url", image_url: { url: `data:image/png;base64,${request.imageBase64}` } };

  const response = await fetchNineRouterText(
    "/chat/completions",
    {
      model: request.providerModel,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: request.prompt },
            imagePayload,
            ...(request.referenceImages ?? []).map((item) => ({
              type: "image_url",
              image_url: {
                url: item.image_url ?? `data:image/png;base64,${item.image_base64}`
              }
            }))
          ]
        }
      ],
      max_tokens: request.maxTokens,
      metadata: {
        ...request.metadata,
        gateway_request_id: request.requestId,
        client_id: request.clientId
      }
    },
    "9router vision provider"
  );
  const payload = parseNineRouterChatPayload(response.body);

  return {
    id: request.requestId,
    model: request.model,
    content: extractContent(payload) ?? "",
    latency_ms: response.latencyMs,
    usage: {
      input_tokens: payload.usage?.input_tokens ?? payload.usage?.prompt_tokens ?? null,
      output_tokens: payload.usage?.output_tokens ?? payload.usage?.completion_tokens ?? null,
      source: payload.usage ? "provider" : "unavailable"
    },
    provider_metadata: {
      provider_id: payload.id,
      upstream_provider: payload.upstream_provider ?? payload.provider,
      upstream_model: payload.upstream_model ?? request.providerModel,
      fallback_used: payload.fallback_used ?? false
    }
  };
}

export async function listNineRouterModels(): Promise<Array<{ id: string; displayName?: string; kind?: string }>> {
  if (!env.NINEROUTER_BASE_URL) {
    throw new GatewayError("PROVIDER_NOT_CONFIGURED", "NINEROUTER_BASE_URL is not configured", 503);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.NINEROUTER_TIMEOUT_SECONDS * 1000);

  try {
    const baseUrl = env.NINEROUTER_BASE_URL.replace(/\/$/, "");
    const paths = ["/models", ...nineRouterModelKinds.map((kind) => `/models/${kind}`)];
    const byId = new Map<string, { id: string; displayName?: string; kind?: string }>();

    for (const path of paths) {
      const response = await fetch(`${baseUrl}${path}`, {
        method: "GET",
        signal: controller.signal,
        headers: nineRouterHeaders()
      });

      if (!response.ok) {
        if (path !== "/models") continue;
        throw new GatewayError("PROVIDER_ERROR", `9router models returned ${response.status}`, response.status);
      }

      const payload = (await response.json()) as NineRouterModelsResponse;
      const kind = path === "/models" ? "chat" : path.replace("/models/", "");
      for (const id of (payload.data ?? []).map((model) => model.id).filter((id): id is string => Boolean(id))) {
        byId.set(id, { id, displayName: id, kind });
      }
    }

    return [...byId.values()];
  } catch (error) {
    if (error instanceof GatewayError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new GatewayError("PROVIDER_TIMEOUT", "9router models request timed out", 504);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function testNineRouterConnection(): Promise<Record<string, unknown>> {
  if (!env.NINEROUTER_BASE_URL) {
    throw new GatewayError("PROVIDER_NOT_CONFIGURED", "NINEROUTER_BASE_URL is not configured", 503);
  }

  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.NINEROUTER_TIMEOUT_SECONDS * 1000);

  try {
    const baseUrl = new URL(env.NINEROUTER_BASE_URL);
    const url = env.NINEROUTER_API_KEY
      ? `${env.NINEROUTER_BASE_URL.replace(/\/$/, "")}/models`
      : `${baseUrl.origin}/`;

    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: nineRouterHeaders()
    });

    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      latency_ms: Date.now() - started,
      api_key_configured: Boolean(env.NINEROUTER_API_KEY),
      checked_url: env.NINEROUTER_API_KEY ? "/v1/models" : "/",
      body: text.slice(0, 1000)
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new GatewayError("PROVIDER_TIMEOUT", "9router health check timed out", 504);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
