import { env } from "../config/env.js";
import { modelRoutes } from "../config/models.js";
import { GatewayError } from "../errors/gateway-error.js";
import { parseSseJson, parseSseStream } from "./sse-parser.js";
import type {
  GatewayChatRequest,
  GatewayChatResponse,
  GatewayModel,
  StreamChunk,
  StreamingAiProviderAdapter
} from "./types.js";

type OpenAiChatResponse = {
  id?: string;
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
};

export class OpenAiCompatibleAdapter implements StreamingAiProviderAdapter {
  readonly provider = "openai" as const;

  async chat(request: GatewayChatRequest): Promise<GatewayChatResponse> {
    if (!env.OPENAI_API_KEY) {
      throw new GatewayError("PROVIDER_NOT_CONFIGURED", "OPENAI_API_KEY is not configured", 503);
    }

    const started = Date.now();
    const timeoutMs = 120_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${env.OPENAI_BASE_URL}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          authorization: `Bearer ${env.OPENAI_API_KEY}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: request.providerModel,
          messages: request.messages,
          temperature: request.temperature,
          max_tokens: request.maxTokens
        })
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        throw new GatewayError("PROVIDER_TIMEOUT", "OpenAI-compatible provider request timed out", 504);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new GatewayError("PROVIDER_ERROR", `OpenAI-compatible provider returned ${response.status}`, response.status);
    }

    const payload = (await response.json()) as OpenAiChatResponse;
    const content = payload.choices?.[0]?.message?.content;

    if (!content) {
      throw new GatewayError("PROVIDER_ERROR", "OpenAI-compatible provider returned an empty response");
    }

    return {
      id: request.requestId,
      model: request.model,
      provider: this.provider,
      content,
      usage: {
        input_tokens: payload.usage?.prompt_tokens ?? null,
        output_tokens: payload.usage?.completion_tokens ?? null,
        source: payload.usage ? "provider" : "unavailable"
      },
      latency_ms: Date.now() - started,
      provider_metadata: {
        provider_id: payload.id
      }
    };
  }

  async chatStream(request: GatewayChatRequest): Promise<AsyncIterable<StreamChunk>> {
    if (!env.OPENAI_API_KEY) {
      throw new GatewayError("PROVIDER_NOT_CONFIGURED", "OPENAI_API_KEY is not configured", 503);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);

    let response: Response;
    try {
      response = await fetch(`${env.OPENAI_BASE_URL}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          authorization: `Bearer ${env.OPENAI_API_KEY}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: request.providerModel,
          messages: request.messages,
          temperature: request.temperature,
          max_tokens: request.maxTokens,
          stream: true,
          stream_options: { include_usage: true }
        })
      });
    } catch (err) {
      clearTimeout(timer);
      if ((err as Error).name === "AbortError") {
        throw new GatewayError("PROVIDER_TIMEOUT", "OpenAI-compatible streaming request timed out", 504);
      }
      throw err;
    }

    if (!response.ok || !response.body) {
      clearTimeout(timer);
      throw new GatewayError("PROVIDER_ERROR", `OpenAI-compatible provider returned ${response.status}`, response.status);
    }

    const body = response.body;
    async function* generate(): AsyncIterable<StreamChunk> {
      let inputTokens: number | null = null;
      let outputTokens: number | null = null;
      let completed = false;
      try {
        for await (const event of parseSseStream(body)) {
          if (event.data === "[DONE]") {
            completed = true;
            continue;
          }
          const payload = parseSseJson(event.data);
          if (payload.error) {
            const error = payload.error as Record<string, unknown>;
            throw new GatewayError("PROVIDER_ERROR", typeof error.message === "string" ? error.message : "OpenAI-compatible stream failed");
          }
          const choices = payload.choices as Array<Record<string, unknown>> | undefined;
          const delta = choices?.[0]?.delta as Record<string, unknown> | undefined;
          const text = typeof delta?.content === "string" ? delta.content : "";
          if (text) yield { content: text, done: false };
          const usage = payload.usage as Record<string, unknown> | undefined;
          inputTokens = typeof usage?.prompt_tokens === "number" ? usage.prompt_tokens : inputTokens;
          outputTokens = typeof usage?.completion_tokens === "number" ? usage.completion_tokens : outputTokens;
        }
        if (!completed) throw new GatewayError("PROVIDER_ERROR", "OpenAI-compatible stream ended before [DONE]");
        yield {
          content: "",
          done: true,
          usage: {
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            source: inputTokens !== null || outputTokens !== null ? "provider" : "unavailable"
          }
        };
      } finally {
        clearTimeout(timer);
      }
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
