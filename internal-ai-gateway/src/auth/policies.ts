import type { ResolvedPolicy } from "../db/repositories/types.js";
import type { ApiKeyContext } from "../db/repositories/types.js";
import { getDailyRequestCountForApiKey, getMonthlyTokenCountForUser } from "../db/repositories/usage.js";
import { GatewayError } from "../errors/gateway-error.js";
import { dispatchWebhook } from "../observability/webhook-dispatcher.js";
import type { GatewayMessage, TaskType } from "../providers/types.js";

export function assertModelAllowed(policy: ResolvedPolicy, model: string): void {
  if (!policy.allowedModels.includes(model)) {
    throw new GatewayError("FORBIDDEN_MODEL", `Policy ${policy.source} cannot use model ${model}`, 403);
  }
}

export function assertTaskAllowed(policy: ResolvedPolicy, taskType: TaskType): void {
  if (!policy.allowedTaskTypes.includes(taskType)) {
    throw new GatewayError("TASK_NOT_ALLOWED", `Policy ${policy.source} cannot use task_type=${taskType}`, 403);
  }
}

export function assertInputSizeAllowed(policy: ResolvedPolicy, messages: GatewayMessage[]): void {
  const totalCharacters = messages.reduce((sum, message) => sum + message.content.length, 0);
  if (totalCharacters > policy.maxInputCharacters) {
    throw new GatewayError("INVALID_REQUEST", `Input is too large for policy ${policy.source}`, 413);
  }
}

export function assertQuotaAllowed(context: ApiKeyContext): void {
  if (context.policy.dailyRequestLimit != null) {
    const requestCount = getDailyRequestCountForApiKey(context.apiKey.id);
    if (requestCount >= context.policy.dailyRequestLimit) {
      dispatchWebhook("quota.warning", {
        api_key_id: context.apiKey.id,
        user_id: context.user.id,
        type: "daily",
        limit: context.policy.dailyRequestLimit,
        current: requestCount
      }).catch(() => {});
      throw new GatewayError("QUOTA_EXCEEDED", `Daily request quota exceeded for API key ${context.apiKey.id}`, 429);
    }
  }

  if (context.policy.monthlyTokenLimit != null) {
    const tokenCount = getMonthlyTokenCountForUser(context.user.id);
    if (tokenCount >= context.policy.monthlyTokenLimit) {
      dispatchWebhook("quota.warning", {
        api_key_id: context.apiKey.id,
        user_id: context.user.id,
        type: "monthly",
        limit: context.policy.monthlyTokenLimit,
        current: tokenCount
      }).catch(() => {});
      throw new GatewayError("QUOTA_EXCEEDED", `Monthly token quota exceeded for user ${context.user.id}`, 429);
    }
  }
}
