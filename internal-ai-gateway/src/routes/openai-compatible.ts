import { nanoid } from "nanoid";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { apiKeyAuth } from "../auth/api-key-auth.js";
import { assertInputSizeAllowed, assertModelAllowed, assertQuotaAllowed, assertTaskAllowed } from "../auth/policies.js";
import { assertPerKeyRateLimit } from "../auth/rate-limit.js";
import { estimateTokenCostUsd } from "../billing/cost-estimator.js";
import { GatewayError, toGatewayError } from "../errors/gateway-error.js";
import { writeAuditLog } from "../observability/audit-log.js";
import { getAdapter, resolveModelRoute, resolveSmartModelRoute } from "../router/model-router.js";

const chatCompletionsSchema = z.object({
  model: z.string().min(1),
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string().min(1)
      })
    )
    .min(1),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().optional(),
  stream: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export async function openAiCompatibleRoutes(app: FastifyInstance): Promise<void> {
  app.post("/v1/chat/completions", { preHandler: apiKeyAuth }, async (request, reply) => {
    const requestId = nanoid();
    const started = Date.now();
    const context = request.apiKeyContext;
    reply.header("x-request-id", requestId);

    if (!context) {
      throw new GatewayError("UNAUTHORIZED", "Missing API key context", 401);
    }

    let routeProvider: ReturnType<typeof resolveModelRoute>["provider"] | undefined;
    let model: string | undefined;

    try {
      const body = chatCompletionsSchema.parse(request.body);
      model = body.model;

      if (body.stream) {
        throw new GatewayError("INVALID_REQUEST", "Streaming is not implemented in the gateway yet", 400);
      }

      if (body.model !== "auto") {
        assertModelAllowed(context.policy, body.model);
      }
      assertTaskAllowed(context.policy, "chat");
      assertInputSizeAllowed(context.policy, body.messages);
      assertQuotaAllowed(context);
      assertPerKeyRateLimit(context);

      const route = resolveSmartModelRoute(body.model, "chat", context);
      routeProvider = route.provider;
      const adapter = getAdapter(route.provider);
      const response = await adapter.chat({
        requestId,
        clientId: context.client.id,
        model: route.model,
        providerModel: route.providerModel,
        taskType: "chat",
        messages: body.messages,
        temperature: body.temperature,
        maxTokens: body.max_tokens,
        metadata: { ...body.metadata, openai_compatible: true }
      });

      await writeAuditLog({
        estimated_cost: estimateTokenCostUsd({
          provider: route.provider,
          model: route.model,
          upstreamModel: typeof response.provider_metadata?.upstream_model === "string" ? response.provider_metadata.upstream_model : null,
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens
        }),
        request_id: requestId,
        user_id: context.user.id,
        api_key_id: context.apiKey.id,
        client_id: context.client.id,
        provider: route.provider,
        model: route.model,
        latency_ms: response.latency_ms,
        status: "ok",
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        upstream_provider:
          typeof response.provider_metadata?.upstream_provider === "string" ? response.provider_metadata.upstream_provider : null,
        upstream_model:
          typeof response.provider_metadata?.upstream_model === "string" ? response.provider_metadata.upstream_model : null,
        usage_source: response.usage.source,
        created_at: new Date().toISOString()
      });

      return {
        id: `chatcmpl_${requestId}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: route.model,
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: response.content
            },
            finish_reason: "stop"
          }
        ],
        usage: {
          prompt_tokens: response.usage.input_tokens,
          completion_tokens: response.usage.output_tokens,
          total_tokens:
            response.usage.input_tokens == null || response.usage.output_tokens == null
              ? null
              : response.usage.input_tokens + response.usage.output_tokens
        }
      };
    } catch (error) {
      const gatewayError = error instanceof z.ZodError ? new GatewayError("INVALID_REQUEST", error.message, 400) : toGatewayError(error);

      await writeAuditLog({
        request_id: requestId,
        user_id: context.user.id,
        api_key_id: context.apiKey.id,
        client_id: context.client.id,
        provider: routeProvider,
        model,
        latency_ms: Date.now() - started,
        status: "error",
        error_code: gatewayError.code,
        created_at: new Date().toISOString()
      });

      return reply.status(gatewayError.statusCode).send({
        error: {
          message: gatewayError.message,
          type: gatewayError.code,
          code: gatewayError.code
        }
      });
    }
  });
}
