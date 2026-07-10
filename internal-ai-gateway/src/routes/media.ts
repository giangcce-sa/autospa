import { nanoid } from "nanoid";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { apiKeyAuth } from "../auth/api-key-auth.js";
import { assertInputSizeAllowed, assertModelAllowed, assertQuotaAllowed, assertTaskAllowed } from "../auth/policies.js";
import { assertPerKeyRateLimit } from "../auth/rate-limit.js";
import { estimateMediaCostUsd } from "../billing/cost-estimator.js";
import { env } from "../config/env.js";
import { GatewayError, toGatewayError } from "../errors/gateway-error.js";
import { type AuditRecord, writeAuditLog } from "../observability/audit-log.js";
import {
  analyzeNineRouterVision,
  createNineRouterEmbedding,
  createNineRouterSpeech,
  transcribeNineRouterAudio
} from "../providers/nine-router.js";
import { resolveSmartModelRoute } from "../router/model-router.js";

const embeddingSchema = z.object({
  model: z.string().min(1).default("auto"),
  input: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  encoding_format: z.enum(["float", "base64"]).optional(),
  dimensions: z.number().int().positive().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

const speechSchema = z.object({
  model: z.string().min(1).default("auto"),
  input: z.string().min(1),
  voice: z.string().min(1).default("alloy"),
  response_format: z.string().min(1).max(16).default("mp3"),
  speed: z.number().positive().max(4).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

const transcriptionSchema = z
  .object({
    model: z.string().min(1).default("auto"),
    file_url: z.string().url().optional(),
    audio_base64: z.string().min(1).optional(),
    language: z.string().min(2).max(16).optional(),
    prompt: z.string().min(1).optional(),
    response_format: z.string().min(1).max(32).optional(),
    temperature: z.number().min(0).max(1).optional(),
    metadata: z.record(z.string(), z.unknown()).optional()
  })
  .refine((body) => Boolean(body.file_url || body.audio_base64), {
    message: "Either file_url or audio_base64 is required"
  });

const visionSchema = z
  .object({
    model: z.string().min(1).default("auto"),
    prompt: z.string().min(1),
    image_url: z.string().url().optional(),
    image_base64: z.string().min(1).optional(),
    max_tokens: z.number().int().positive().optional(),
    metadata: z.record(z.string(), z.unknown()).optional()
  })
  .refine((body) => Boolean(body.image_url || body.image_base64), {
    message: "Either image_url or image_base64 is required"
  });

function normalizeInputForPolicy(input: string | string[]): string {
  return Array.isArray(input) ? input.join("\n") : input;
}

function assertBase64Allowed(value: string | undefined, label: string): void {
  if (!value) return;
  const normalized = value.includes(",") ? value.slice(value.indexOf(",") + 1) : value;
  const clean = normalized.replace(/\s/g, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) {
    throw new GatewayError("INVALID_REQUEST", `${label} must be valid base64`, 400);
  }
  const estimatedBytes = Math.floor((clean.length * 3) / 4) - (clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0);
  if (estimatedBytes > env.MAX_MEDIA_BASE64_BYTES) {
    throw new GatewayError("INVALID_REQUEST", `${label} exceeds max media payload size`, 413);
  }
}

async function handleMediaError(reply: FastifyReply, error: unknown, audit: Omit<AuditRecord, "status" | "error_code">) {
  const gatewayError = error instanceof z.ZodError ? new GatewayError("INVALID_REQUEST", error.message, 400) : toGatewayError(error);
  await writeAuditLog({
    ...audit,
    status: "error",
    error_code: gatewayError.code
  });
  return reply.status(gatewayError.statusCode).send({
    error: {
      code: gatewayError.code,
      message: gatewayError.message,
      request_id: audit.request_id
    }
  });
}

export async function mediaRoutes(app: FastifyInstance): Promise<void> {
  app.post("/v1/embeddings", { preHandler: apiKeyAuth }, async (request, reply) => {
    const requestId = nanoid();
    const started = Date.now();
    const context = request.apiKeyContext;
    reply.header("x-request-id", requestId);
    if (!context) throw new GatewayError("UNAUTHORIZED", "Missing API key context", 401);

    try {
      const body = embeddingSchema.parse(request.body);
      if (body.model !== "auto") assertModelAllowed(context.policy, body.model);
      assertTaskAllowed(context.policy, "embedding");
      assertInputSizeAllowed(context.policy, [{ role: "user", content: normalizeInputForPolicy(body.input) }]);
      assertQuotaAllowed(context);
      assertPerKeyRateLimit(context);

      const route = resolveSmartModelRoute(body.model, "embedding", context);
      if (route.provider !== "9router") {
        throw new GatewayError("PROVIDER_NOT_CONFIGURED", "Embeddings currently require a 9router model", 503);
      }

      const response = await createNineRouterEmbedding({
        requestId,
        clientId: context.client.id,
        model: route.model,
        providerModel: route.providerModel,
        input: body.input,
        encodingFormat: body.encoding_format,
        dimensions: body.dimensions,
        metadata: body.metadata
      });

      const metadata = response.provider_metadata as Record<string, unknown> | undefined;
      const usage = response.usage as { prompt_tokens?: number; total_tokens?: number } | null;
      await writeAuditLog({
        request_id: requestId,
        user_id: context.user.id,
        api_key_id: context.apiKey.id,
        client_id: context.client.id,
        provider: route.provider,
        model: route.model,
        latency_ms: typeof response.latency_ms === "number" ? response.latency_ms : Date.now() - started,
        status: "ok",
        input_tokens: usage?.prompt_tokens ?? usage?.total_tokens ?? null,
        output_tokens: null,
        estimated_cost: estimateMediaCostUsd({
          taskType: "embedding",
          inputTokens: usage?.prompt_tokens ?? usage?.total_tokens ?? null,
          outputTokens: null
        }),
        upstream_provider: typeof metadata?.upstream_provider === "string" ? metadata.upstream_provider : null,
        upstream_model: typeof metadata?.upstream_model === "string" ? metadata.upstream_model : null,
        usage_source: usage ? "provider" : "unavailable",
        created_at: new Date().toISOString()
      });

      return response;
    } catch (error) {
      return handleMediaError(reply, error, {
        request_id: requestId,
        user_id: context.user.id,
        api_key_id: context.apiKey.id,
        client_id: context.client.id,
        latency_ms: Date.now() - started,
        created_at: new Date().toISOString()
      });
    }
  });

  app.post("/v1/audio/speech", { preHandler: apiKeyAuth }, async (request, reply) => {
    const requestId = nanoid();
    const started = Date.now();
    const context = request.apiKeyContext;
    reply.header("x-request-id", requestId);
    if (!context) throw new GatewayError("UNAUTHORIZED", "Missing API key context", 401);

    try {
      const body = speechSchema.parse(request.body);
      if (body.model !== "auto") assertModelAllowed(context.policy, body.model);
      assertTaskAllowed(context.policy, "text-to-speech");
      assertInputSizeAllowed(context.policy, [{ role: "user", content: body.input }]);
      assertQuotaAllowed(context);
      assertPerKeyRateLimit(context);

      const route = resolveSmartModelRoute(body.model, "text-to-speech", context);
      if (route.provider !== "9router") {
        throw new GatewayError("PROVIDER_NOT_CONFIGURED", "Speech currently requires a 9router model", 503);
      }

      const response = await createNineRouterSpeech({
        requestId,
        clientId: context.client.id,
        model: route.model,
        providerModel: route.providerModel,
        input: body.input,
        voice: body.voice,
        responseFormat: body.response_format,
        speed: body.speed,
        metadata: body.metadata
      });

      await writeAuditLog({
        request_id: requestId,
        user_id: context.user.id,
        api_key_id: context.apiKey.id,
        client_id: context.client.id,
        provider: route.provider,
        model: route.model,
        latency_ms: response.latencyMs,
        status: "ok",
        estimated_cost: estimateMediaCostUsd({ taskType: "text-to-speech", units: 1 }),
        usage_source: "unavailable",
        created_at: new Date().toISOString()
      });

      return reply.type(response.contentType).send(response.body);
    } catch (error) {
      return handleMediaError(reply, error, {
        request_id: requestId,
        user_id: context.user.id,
        api_key_id: context.apiKey.id,
        client_id: context.client.id,
        latency_ms: Date.now() - started,
        created_at: new Date().toISOString()
      });
    }
  });

  app.post("/v1/audio/transcriptions", { preHandler: apiKeyAuth }, async (request, reply) => {
    const requestId = nanoid();
    const started = Date.now();
    const context = request.apiKeyContext;
    reply.header("x-request-id", requestId);
    if (!context) throw new GatewayError("UNAUTHORIZED", "Missing API key context", 401);

    try {
      const body = transcriptionSchema.parse(request.body);
      assertBase64Allowed(body.audio_base64, "audio_base64");
      if (body.model !== "auto") assertModelAllowed(context.policy, body.model);
      assertTaskAllowed(context.policy, "speech-to-text");
      assertInputSizeAllowed(context.policy, [{ role: "user", content: body.prompt ?? body.file_url ?? "audio_base64" }]);
      assertQuotaAllowed(context);
      assertPerKeyRateLimit(context);

      const route = resolveSmartModelRoute(body.model, "speech-to-text", context);
      if (route.provider !== "9router") {
        throw new GatewayError("PROVIDER_NOT_CONFIGURED", "Transcription currently requires a 9router model", 503);
      }

      const response = await transcribeNineRouterAudio({
        requestId,
        clientId: context.client.id,
        model: route.model,
        providerModel: route.providerModel,
        fileUrl: body.file_url,
        audioBase64: body.audio_base64,
        language: body.language,
        prompt: body.prompt,
        responseFormat: body.response_format,
        temperature: body.temperature,
        metadata: body.metadata
      });

      const metadata = response.provider_metadata as Record<string, unknown> | undefined;
      await writeAuditLog({
        request_id: requestId,
        user_id: context.user.id,
        api_key_id: context.apiKey.id,
        client_id: context.client.id,
        provider: route.provider,
        model: route.model,
        latency_ms: typeof response.latency_ms === "number" ? response.latency_ms : Date.now() - started,
        status: "ok",
        estimated_cost: estimateMediaCostUsd({ taskType: "speech-to-text", units: 1 }),
        upstream_provider: typeof metadata?.upstream_provider === "string" ? metadata.upstream_provider : null,
        upstream_model: typeof metadata?.upstream_model === "string" ? metadata.upstream_model : null,
        usage_source: "unavailable",
        created_at: new Date().toISOString()
      });

      return response;
    } catch (error) {
      return handleMediaError(reply, error, {
        request_id: requestId,
        user_id: context.user.id,
        api_key_id: context.apiKey.id,
        client_id: context.client.id,
        latency_ms: Date.now() - started,
        created_at: new Date().toISOString()
      });
    }
  });

  app.post("/v1/vision/analyze", { preHandler: apiKeyAuth }, async (request, reply) => {
    const requestId = nanoid();
    const started = Date.now();
    const context = request.apiKeyContext;
    reply.header("x-request-id", requestId);
    if (!context) throw new GatewayError("UNAUTHORIZED", "Missing API key context", 401);

    try {
      const body = visionSchema.parse(request.body);
      assertBase64Allowed(body.image_base64, "image_base64");
      if (body.model !== "auto") assertModelAllowed(context.policy, body.model);
      assertTaskAllowed(context.policy, "vision");
      assertInputSizeAllowed(context.policy, [{ role: "user", content: body.prompt }]);
      assertQuotaAllowed(context);
      assertPerKeyRateLimit(context);

      const route = resolveSmartModelRoute(body.model, "vision", context);
      if (route.provider !== "9router") {
        throw new GatewayError("PROVIDER_NOT_CONFIGURED", "Vision currently requires a 9router model", 503);
      }

      const response = await analyzeNineRouterVision({
        requestId,
        clientId: context.client.id,
        model: route.model,
        providerModel: route.providerModel,
        prompt: body.prompt,
        imageUrl: body.image_url,
        imageBase64: body.image_base64,
        maxTokens: body.max_tokens,
        metadata: body.metadata
      });

      const metadata = response.provider_metadata as Record<string, unknown> | undefined;
      const usage = response.usage as { input_tokens?: number | null; output_tokens?: number | null; source?: string } | undefined;
      await writeAuditLog({
        request_id: requestId,
        user_id: context.user.id,
        api_key_id: context.apiKey.id,
        client_id: context.client.id,
        provider: route.provider,
        model: route.model,
        latency_ms: typeof response.latency_ms === "number" ? response.latency_ms : Date.now() - started,
        status: "ok",
        input_tokens: usage?.input_tokens ?? null,
        output_tokens: usage?.output_tokens ?? null,
        estimated_cost: estimateMediaCostUsd({
          taskType: "vision",
          inputTokens: usage?.input_tokens ?? null,
          outputTokens: usage?.output_tokens ?? null
        }),
        upstream_provider: typeof metadata?.upstream_provider === "string" ? metadata.upstream_provider : null,
        upstream_model: typeof metadata?.upstream_model === "string" ? metadata.upstream_model : null,
        usage_source: usage?.source === "provider" ? "provider" : "unavailable",
        created_at: new Date().toISOString()
      });

      return response;
    } catch (error) {
      return handleMediaError(reply, error, {
        request_id: requestId,
        user_id: context.user.id,
        api_key_id: context.apiKey.id,
        client_id: context.client.id,
        latency_ms: Date.now() - started,
        created_at: new Date().toISOString()
      });
    }
  });
}
