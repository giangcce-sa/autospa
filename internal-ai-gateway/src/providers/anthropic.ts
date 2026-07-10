import { env } from "../config/env.js";
import { modelRoutes } from "../config/models.js";
import { GatewayError } from "../errors/gateway-error.js";
import type {
  GatewayChatRequest,
  GatewayChatResponse,
  GatewayModel,
  GatewayMessage,
  StreamChunk,
  StreamingAiProviderAdapter
} from "./types.js";

type AnthropicResponse = {
  id?: string;
  content?: Array<{
    type: string;
    text?: string;
  }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
};

function splitSystemMessages(messages: GatewayMessage[]) {
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");

  const conversation = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role,
      content: message.content
    }));

  return { system, conversation };
}

export class AnthropicAdapter implements StreamingAiProviderAdapter {
  readonly provider = "anthropic" as const;

  async chat(request: GatewayChatRequest): Promise<GatewayChatResponse> {
    if (!env.ANTHROPIC_API_KEY) {
      throw new GatewayError("PROVIDER_NOT_CONFIGURED", "ANTHROPIC_API_KEY is not configured", 503);
    }

    const started = Date.now();
    const { system, conversation } = splitSystemMessages(request.messages);

    const timeoutMs = 120_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${env.ANTHROPIC_BASE_URL}/v1/messages`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": env.ANTHROPIC_VERSION,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: request.providerModel,
          system: system || undefined,
          messages: conversation,
          temperature: request.temperature,
          max_tokens: request.maxTokens ?? 1200
        })
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        throw new GatewayError("PROVIDER_TIMEOUT", "Anthropic request timed out", 504);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new GatewayError("PROVIDER_ERROR", `Anthropic provider returned ${response.status}`, response.status);
    }

    const payload = (await response.json()) as AnthropicResponse;
    const content = payload.content?.find((part) => part.type === "text")?.text;

    if (!content) {
      throw new GatewayError("PROVIDER_ERROR", "Anthropic provider returned an empty response");
    }

    return {
      id: request.requestId,
      model: request.model,
      provider: this.provider,
      content,
      usage: {
        input_tokens: payload.usage?.input_tokens ?? null,
        output_tokens: payload.usage?.output_tokens ?? null,
        source: payload.usage ? "provider" : "unavailable"
      },
      latency_ms: Date.now() - started,
      provider_metadata: {
        provider_id: payload.id
      }
    };
  }

  async chatStream(request: GatewayChatRequest): Promise<AsyncIterable<StreamChunk>> {
    if (!env.ANTHROPIC_API_KEY) {
      throw new GatewayError("PROVIDER_NOT_CONFIGURED", "ANTHROPIC_API_KEY is not configured", 503);
    }
    const { system, conversation } = splitSystemMessages(request.messages);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);

    let response: Response;
    try {
      response = await fetch(`${env.ANTHROPIC_BASE_URL}/v1/messages`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": env.ANTHROPIC_VERSION,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: request.providerModel,
          system: system || undefined,
          messages: conversation,
          temperature: request.temperature,
          max_tokens: request.maxTokens ?? 1200,
          stream: true
        })
      });
    } catch (err) {
      clearTimeout(timer);
      if ((err as Error).name === "AbortError") {
        throw new GatewayError("PROVIDER_TIMEOUT", "Anthropic streaming request timed out", 504);
      }
      throw err;
    }

    if (!response.ok || !response.body) {
      clearTimeout(timer);
      throw new GatewayError("PROVIDER_ERROR", `Anthropic provider returned ${response.status}`, response.status);
    }

    const body = response.body;
    async function* generate(): AsyncIterable<StreamChunk> {
      let inputTokens: number | null = null;
      let outputTokens: number | null = null;
      let buffer = "";
      const reader = body.getReader();
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (!raw) continue;
            let evt: Record<string, unknown>;
            try {
              evt = JSON.parse(raw) as Record<string, unknown>;
            } catch {
              continue;
            }
            if (evt.type === "content_block_delta") {
              const delta = evt.delta as Record<string, unknown> | undefined;
              const text = typeof delta?.text === "string" ? delta.text : "";
              if (text) yield { content: text, done: false };
            } else if (evt.type === "message_start") {
              const msg = evt.message as Record<string, unknown> | undefined;
              const usage = msg?.usage as Record<string, unknown> | undefined;
              if (usage) {
                inputTokens = typeof usage.input_tokens === "number" ? usage.input_tokens : null;
              }
            } else if (evt.type === "message_delta") {
              const usage = (evt as Record<string, unknown>).usage as Record<string, unknown> | undefined;
              if (usage) {
                outputTokens = typeof usage.output_tokens === "number" ? usage.output_tokens : null;
              }
            }
          }
        }
      } finally {
        clearTimeout(timer);
        reader.releaseLock();
      }
      yield {
        content: "",
        done: true,
        usage: {
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          source: inputTokens !== null || outputTokens !== null ? "provider" : "unavailable"
        }
      };
    }
    return generate();
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
