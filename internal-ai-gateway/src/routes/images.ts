import { nanoid } from "nanoid";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { apiKeyAuth } from "../auth/api-key-auth.js";
import { assertInputSizeAllowed, assertModelAllowed, assertQuotaAllowed, assertTaskAllowed } from "../auth/policies.js";
import { assertPerKeyRateLimit } from "../auth/rate-limit.js";
import { estimateMediaCostUsd } from "../billing/cost-estimator.js";
import { imageCapabilities } from "../config/capabilities.js";
import { GatewayError, toGatewayError } from "../errors/gateway-error.js";
import { writeAuditLog } from "../observability/audit-log.js";
import { generateNineRouterImage } from "../providers/nine-router.js";
import { resolveSmartModelRoute } from "../router/model-router.js";

const imageGenerationSchema = z.object({
  model: z.string().min(1).default("auto"),
  task_type: z.enum(["image-generation", "image-edit"]).default("image-generation"),
  prompt: z.string().min(1),
  n: z.number().int().min(1).max(4).optional(),
  size: z.string().min(3).max(32).optional(),
  quality: z.string().min(1).max(32).optional(),
  style: z.string().min(1).max(32).optional(),
  response_format: z.enum(["url", "b64_json"]).optional(),
  reference_mode: z.enum(["identity", "appearance", "style"]).optional(),
  reference_strength: z.number().min(0).max(1).optional(),
  reference_images: z.array(z.object({
    image_url: z.string().url().optional(),
    image_base64: z.string().min(1).optional(),
    weight: z.number().min(0).max(1).optional()
  }).refine((item) => Boolean(item.image_url || item.image_base64), {
    message: "Reference image requires image_url or image_base64"
  })).max(4).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export async function imageRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/images/capabilities", { preHandler: apiKeyAuth }, async (request) => {
    if (!request.apiKeyContext) throw new GatewayError("UNAUTHORIZED", "Missing API key context", 401);
    return {
      data: {
        generation: true,
        edit: true,
        reference_images: true,
        max_reference_images: 4,
        reference_modes: ["identity", "appearance", "style"],
        max_variants: 4,
        vision_quality_check: true
      }
    };
  });

  app.post("/v1/images/generations", { preHandler: apiKeyAuth }, async (request, reply) => {
    const requestId = nanoid();
    const started = Date.now();
    const context = request.apiKeyContext;
    reply.header("x-request-id", requestId);

    if (!context) {
      throw new GatewayError("UNAUTHORIZED", "Missing API key context", 401);
    }

    let model: string | undefined;

    try {
      const body = imageGenerationSchema.parse(request.body);
      model = body.model;

      for (const reference of body.reference_images ?? []) {
        if (reference.image_base64 && reference.image_base64.length > 12_000_000) {
          throw new GatewayError("INVALID_REQUEST", "Reference image exceeds maximum payload size", 413);
        }
      }

      if (!imageCapabilities.includes(body.task_type)) {
        throw new GatewayError("INVALID_REQUEST", `Unsupported image task_type=${body.task_type}`, 400);
      }

      if (body.model !== "auto") {
        assertModelAllowed(context.policy, body.model);
      }
      assertTaskAllowed(context.policy, body.task_type);
      assertInputSizeAllowed(context.policy, [{ role: "user", content: body.prompt }]);
      assertQuotaAllowed(context);
      assertPerKeyRateLimit(context);

      const route = resolveSmartModelRoute(body.model, body.task_type, context);
      if (route.provider !== "9router") {
        throw new GatewayError("PROVIDER_NOT_CONFIGURED", "Image generation currently requires a 9router model", 503);
      }

      const response = await generateNineRouterImage({
        requestId,
        clientId: context.client.id,
        model: route.model,
        providerModel: route.providerModel,
        prompt: body.prompt,
        n: body.n,
        size: body.size,
        quality: body.quality,
        style: body.style,
        responseFormat: body.response_format,
        referenceMode: body.reference_mode,
        referenceStrength: body.reference_strength,
        referenceImages: body.reference_images,
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
        estimated_cost: estimateMediaCostUsd({ taskType: body.task_type, units: body.n ?? 1 }),
        upstream_provider: typeof metadata?.upstream_provider === "string" ? metadata.upstream_provider : null,
        upstream_model: typeof metadata?.upstream_model === "string" ? metadata.upstream_model : null,
        usage_source: "unavailable",
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
        model,
        latency_ms: Date.now() - started,
        status: "error",
        error_code: gatewayError.code,
        created_at: new Date().toISOString()
      });

      return reply.status(gatewayError.statusCode).send({
        error: {
          code: gatewayError.code,
          message: gatewayError.message,
          request_id: requestId
        }
      });
    }
  });
}
