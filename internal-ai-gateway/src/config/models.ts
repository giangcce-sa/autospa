import type { TaskType } from "../providers/types.js";
import { gatewayCapabilities } from "./capabilities.js";

export type ProviderName = "anthropic" | "openai" | "kiro-cli" | "9router";

export type ModelRoute = {
  model: string;
  provider: ProviderName;
  providerModel: string;
  allowedTaskTypes?: TaskType[];
};

export const modelRoutes: ModelRoute[] = [
  {
    model: "claude-sonnet",
    provider: "anthropic",
    providerModel: "claude-sonnet-4"
  },
  {
    model: "gpt-4.1-mini",
    provider: "openai",
    providerModel: "gpt-4.1-mini"
  },
  {
    model: "kiro-pro",
    provider: "kiro-cli",
    providerModel: "default",
    allowedTaskTypes: ["coding", "review", "test-generation", "repo-analysis"]
  },
  {
    model: "cheap-chat",
    provider: "9router",
    providerModel: "kr/claude-haiku-4.5"
  },
  {
    model: "strong-code",
    provider: "9router",
    providerModel: "kr/qwen3-coder-next",
    allowedTaskTypes: ["coding", "review", "test-generation", "repo-analysis"]
  },
  {
    model: "spa-assistant",
    provider: "9router",
    providerModel: "kr/claude-haiku-4.5",
    allowedTaskTypes: ["chat", "spa-chat"]
  },
  {
    model: "cx/gpt-5.5",
    provider: "9router",
    providerModel: "cx/gpt-5.5",
    allowedTaskTypes: ["chat", "spa-chat"]
  },
  {
    model: "cx/gpt-5.5-review",
    provider: "9router",
    providerModel: "cx/gpt-5.5-review",
    allowedTaskTypes: ["review"]
  },
  {
    model: "cx/gpt-5.4",
    provider: "9router",
    providerModel: "cx/gpt-5.4",
    allowedTaskTypes: ["chat", "spa-chat"]
  },
  {
    model: "cx/gpt-5.4-mini",
    provider: "9router",
    providerModel: "cx/gpt-5.4-mini",
    allowedTaskTypes: ["chat", "spa-chat"]
  }
];

export function listGatewayModels() {
  return [
    {
      id: "auto",
      provider: "9router",
      provider_model: "model-registry",
      allowed_task_types: [...gatewayCapabilities]
    },
    ...modelRoutes.map((route) => ({
      id: route.model,
      provider: route.provider,
      provider_model: route.providerModel,
      allowed_task_types: route.allowedTaskTypes ?? null
    }))
  ];
}
