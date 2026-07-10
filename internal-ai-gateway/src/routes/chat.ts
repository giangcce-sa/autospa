import { nanoid } from "nanoid";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { apiKeyAuth } from "../auth/api-key-auth.js";
import { assertInputSizeAllowed, assertModelAllowed, assertQuotaAllowed, assertTaskAllowed } from "../auth/policies.js";
import { assertPerKeyRateLimit } from "../auth/rate-limit.js";
import { estimateTokenCostUsd } from "../billing/cost-estimator.js";
import { gatewayCapabilities, isTextCapability } from "../config/capabilities.js";
import { GatewayError, toGatewayError } from "../errors/gateway-error.js";
import { writeAuditLog } from "../observability/audit-log.js";
import { getAdapter, resolveModelRoute, resolveSmartModelRoute } from "../router/model-router.js";
import { supportsStreaming, type TokenUsage } from "../providers/types.js";

const chatRequestSchema = z.object({
  model: z.string().min(1),
  task_type: z.enum(gatewayCapabilities).default("chat"),
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
  metadata: z.record(z.string(), z.unknown()).optional(),
  stream: z.boolean().optional()
});

export async function chatRoutes(app: FastifyInstance): Promise<void> {
  app.post("/v1/chat", {
    preHandler: apiKeyAuth,
    schema: {
      tags: ["Chat"],
      summary: "Send a chat request",
      security: [{ apiKey: [] }],
      body: {
        type: "object",
        required: ["model", "messages"],
        properties: {
          model: { type: "string", description: "Model alias or \"auto\"" },
          task_type: { type: "string", enum: ["chat", "coding", "review", "test-generation", "repo-analysis", "spa-chat", "workflow"] },
          messages: {
            type: "array",
            items: {
              type: "object",
              properties: {
                role: { type: "string" },
                content: { type: "string" }
              }
            }
          },
          temperature: { type: "number" },
          max_tokens: { type: "integer" },
          stream: { type: "boolean" }
        }
      },
      response: {
        200: {
          type: "object",
          additionalProperties: true,
          properties: {
            id: { type: "string" },
            model: { type: "string" },
            provider: { type: "string" },
            content: { type: "string" },
            usage: {
              type: "object",
              additionalProperties: true,
              properties: {
                input_tokens: { type: "number", nullable: true },
                output_tokens: { type: "number", nullable: true },
                source: { type: "string" }
              }
            },
            latency_ms: { type: "number" }
          }
        }
      }
    }
  }, async (request, reply) => {
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
      const body = chatRequestSchema.parse(request.body);
      model = body.model;
      if (!isTextCapability(body.task_type)) {
        throw new GatewayError("INVALID_REQUEST", `Use the dedicated endpoint for task_type=${body.task_type}`, 400);
      }

      if (body.model !== "auto") {
        assertModelAllowed(context.policy, body.model);
      }
      assertTaskAllowed(context.policy, body.task_type);
      assertInputSizeAllowed(context.policy, body.messages);
      assertQuotaAllowed(context);
      assertPerKeyRateLimit(context);

      const route = resolveSmartModelRoute(body.model, body.task_type, context);
      routeProvider = route.provider;
      const adapter = getAdapter(route.provider);

      // Streaming path
      if (body.stream === true) {
        if (!supportsStreaming(adapter)) {
          throw new GatewayError(
            "INVALID_REQUEST",
            `Provider ${route.provider} does not support streaming`,
            400
          );
        }

        reply.raw.setHeader("Content-Type", "text/event-stream; charset=utf-8");
        reply.raw.setHeader("Cache-Control", "no-cache");
        reply.raw.setHeader("Connection", "keep-alive");
        reply.raw.setHeader("x-request-id", requestId);
        reply.hijack();

        let lastUsage: TokenUsage = { input_tokens: null, output_tokens: null, source: "unavailable" };
        try {
          const stream = await adapter.chatStream({
            requestId,
            clientId: context.client.id,
            model: route.model,
            providerModel: route.providerModel,
            taskType: body.task_type,
            messages: body.messages,
            temperature: body.temperature,
            maxTokens: body.max_tokens,
            metadata: body.metadata
          });

          for await (const chunk of stream) {
            if (chunk.done) {
              lastUsage = chunk.usage;
              break;
            }
            const payload = JSON.stringify({
              id: requestId,
              object: "chat.completion.chunk",
              model: route.model,
              choices: [{ index: 0, delta: { content: chunk.content }, finish_reason: null }]
            });
            reply.raw.write("data: " + payload + "\n\n");
          }
          reply.raw.write("data: [DONE]\n\n");
          reply.raw.end();
        } catch (streamErr) {
          const ge = toGatewayError(streamErr);
          const errPayload = JSON.stringify({
            error: { code: ge.code, message: ge.message, request_id: requestId }
          });
          try {
            reply.raw.write("data: " + errPayload + "\n\n");
            reply.raw.write("data: [DONE]\n\n");
            reply.raw.end();
          } catch {
            /* ignore */
          }
          await writeAuditLog({
            request_id: requestId,
            user_id: context.user.id,
            api_key_id: context.apiKey.id,
            client_id: context.client.id,
            provider: route.provider,
            model: route.model,
            latency_ms: Date.now() - started,
            status: "error",
            error_code: ge.code,
            created_at: new Date().toISOString()
          });
          return;
        }

        await writeAuditLog({
          estimated_cost: estimateTokenCostUsd({
            provider: route.provider,
            model: route.model,
            upstreamModel: null,
            inputTokens: lastUsage.input_tokens,
            outputTokens: lastUsage.output_tokens
          }),
          request_id: requestId,
          user_id: context.user.id,
          api_key_id: context.apiKey.id,
          client_id: context.client.id,
          provider: route.provider,
          model: route.model,
          latency_ms: Date.now() - started,
          status: "ok",
          input_tokens: lastUsage.input_tokens,
          output_tokens: lastUsage.output_tokens,
          usage_source: lastUsage.source,
          created_at: new Date().toISOString()
        });
        return;
      }

      const response = await adapter.chat({
        requestId,
        clientId: context.client.id,
        model: route.model,
        providerModel: route.providerModel,
        taskType: body.task_type,
        messages: body.messages,
        temperature: body.temperature,
        maxTokens: body.max_tokens,
        metadata: body.metadata
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
        exit_code: typeof response.provider_metadata?.exit_code === "number" ? response.provider_metadata.exit_code : null,
        timed_out: Boolean(response.provider_metadata?.timed_out),
        upstream_provider:
          typeof response.provider_metadata?.upstream_provider === "string" ? response.provider_metadata.upstream_provider : null,
        upstream_model:
          typeof response.provider_metadata?.upstream_model === "string" ? response.provider_metadata.upstream_model : null,
        working_directory:
          typeof response.provider_metadata?.working_directory === "string" ? response.provider_metadata.working_directory : undefined,
        usage_source: response.usage.source,
        created_at: new Date().toISOString()
      });

      return response;
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

      (reply as unknown as { status: (n: number) => unknown }).status(gatewayError.statusCode);
      return reply.send({
        error: {
          code: gatewayError.code,
          message: gatewayError.message,
          request_id: requestId
        }
      } as unknown as Record<string, unknown>);
    }
  });
}
