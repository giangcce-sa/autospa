import { modelRoutes, type ProviderName } from "../config/models.js";
import { isTextCapability } from "../config/capabilities.js";
import type { ApiKeyContext, ResolvedPolicy } from "../db/repositories/types.js";
import { selectBestModelForTask } from "../db/repositories/model-registry.js";
import { selectRoutingRuleForContext } from "../db/repositories/routing-rules.js";
import { GatewayError } from "../errors/gateway-error.js";
import { AnthropicAdapter } from "../providers/anthropic.js";
import { KiroCliAdapter } from "../providers/kiro-cli.js";
import { NineRouterAdapter } from "../providers/nine-router.js";
import { OpenAiCompatibleAdapter } from "../providers/openai-compatible.js";
import type { AiProviderAdapter, TaskType } from "../providers/types.js";

type CostTier = "cheap" | "balanced" | "strong";

const adapters: Record<ProviderName, AiProviderAdapter> = {
  anthropic: new AnthropicAdapter(),
  openai: new OpenAiCompatibleAdapter(),
  "kiro-cli": new KiroCliAdapter(),
  "9router": new NineRouterAdapter()
};

export function resolveModelRoute(model: string, taskType: TaskType) {
  const route = modelRoutes.find((candidate) => candidate.model === model);
  if (!route) {
    throw new GatewayError("MODEL_NOT_FOUND", `Unknown model: ${model}`, 404);
  }

  if (route.allowedTaskTypes && !route.allowedTaskTypes.includes(taskType)) {
    throw new GatewayError("TASK_NOT_ALLOWED", `Model ${model} is not allowed for task_type=${taskType}`, 403);
  }

  return route;
}

function tierForRoute(providerModel: string): CostTier {
  const model = providerModel.toLowerCase();
  if (/haiku|mini|flash|cheap|lite|turbo/.test(model)) return "cheap";
  if (/opus|sonnet|gpt-5|gpt-4|coder|pro|plus|max/.test(model)) return "strong";
  return "balanced";
}

function assertProviderAndCostAllowed(policy: ResolvedPolicy, provider: ProviderName, costTier: CostTier): void {
  if (policy.allowedProviders.length > 0 && !policy.allowedProviders.includes(provider)) {
    throw new GatewayError("PROVIDER_NOT_ALLOWED", `Policy ${policy.source} cannot use provider ${provider}`, 403);
  }
  if (policy.allowedCostTiers.length > 0 && !policy.allowedCostTiers.includes(costTier)) {
    throw new GatewayError("COST_TIER_NOT_ALLOWED", `Policy ${policy.source} cannot use cost tier ${costTier}`, 403);
  }
}

export function resolveSmartModelRoute(model: string, taskType: TaskType, context: ApiKeyContext) {
  if (model !== "auto") {
    const route = resolveModelRoute(model, taskType);
    assertProviderAndCostAllowed(context.policy, route.provider, tierForRoute(route.providerModel));
    return route;
  }

  const rule = selectRoutingRuleForContext({
    apiKeyId: context.apiKey.id,
    clientId: context.client.id,
    userId: context.user.id,
    capability: taskType
  });
  if (rule) {
    assertProviderAndCostAllowed(context.policy, rule.provider, rule.cost_tier);
    return {
      model: `auto:${taskType}`,
      provider: rule.provider,
      providerModel: rule.provider_model,
      allowedTaskTypes: [taskType]
    };
  }

  const registryModel = selectBestModelForTask(taskType, context.policy.allowedModels);
  if (registryModel) {
    assertProviderAndCostAllowed(context.policy, registryModel.provider, registryModel.cost_tier);
    return {
      model: `auto:${taskType}`,
      provider: registryModel.provider,
      providerModel: registryModel.provider_model,
      allowedTaskTypes: registryModel.task_types
    };
  }

  if (!isTextCapability(taskType)) {
    throw new GatewayError("MODEL_NOT_FOUND", `No enabled registry model found for task_type=${taskType}`, 404);
  }

  const fallbackAlias =
    taskType === "coding" || taskType === "review" || taskType === "test-generation" || taskType === "repo-analysis"
      ? "strong-code"
      : taskType === "spa-chat" && context.policy.allowedModels.includes("spa-assistant")
        ? "spa-assistant"
        : "cheap-chat";

  if (!context.policy.allowedModels.includes("auto") && !context.policy.allowedModels.includes(fallbackAlias)) {
    throw new GatewayError("FORBIDDEN_MODEL", `Policy ${context.policy.source} cannot use model auto`, 403);
  }

  const fallbackRoute = resolveModelRoute(fallbackAlias, taskType);
  assertProviderAndCostAllowed(context.policy, fallbackRoute.provider, tierForRoute(fallbackRoute.providerModel));
  return fallbackRoute;
}

export function getAdapter(provider: ProviderName): AiProviderAdapter {
  return adapters[provider];
}
