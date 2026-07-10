import type { ProviderName } from "../config/models.js";
import type { GatewayCapability } from "../config/capabilities.js";

export type MessageRole = "system" | "user" | "assistant";
export type TaskType = GatewayCapability;

export type GatewayMessage = {
  role: MessageRole;
  content: string;
};

export type GatewayChatRequest = {
  requestId: string;
  clientId: string;
  model: string;
  providerModel: string;
  taskType: TaskType;
  messages: GatewayMessage[];
  temperature?: number;
  maxTokens?: number;
  metadata?: Record<string, unknown>;
};

export type TokenUsage = {
  input_tokens: number | null;
  output_tokens: number | null;
  source: "provider" | "estimated" | "unavailable";
};

export type GatewayChatResponse = {
  id: string;
  model: string;
  provider: ProviderName;
  content: string;
  usage: TokenUsage;
  latency_ms: number;
  provider_metadata?: Record<string, unknown>;
};

export type GatewayModel = {
  id: string;
  provider: ProviderName;
  provider_model: string;
};

export interface AiProviderAdapter {
  readonly provider: ProviderName;
  chat(request: GatewayChatRequest): Promise<GatewayChatResponse>;
  listModels(): Promise<GatewayModel[]>;
}

export type StreamChunk =
  | { content: string; done: false }
  | { content: string; done: true; usage: TokenUsage };

export interface StreamingAiProviderAdapter extends AiProviderAdapter {
  chatStream(request: GatewayChatRequest): Promise<AsyncIterable<StreamChunk>>;
}

export function supportsStreaming(adapter: AiProviderAdapter): adapter is StreamingAiProviderAdapter {
  return typeof (adapter as StreamingAiProviderAdapter).chatStream === "function";
}
