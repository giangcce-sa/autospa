import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { incrementPublicRateLimit } from "../auth/public-rate-limit.js";
import { gatewayCapabilities } from "../config/capabilities.js";
import { env } from "../config/env.js";
import { inspectApiKeyContext } from "../db/repositories/api-keys.js";
import { listModelRegistry } from "../db/repositories/model-registry.js";
import { getApiKeyUsageSince } from "../db/repositories/usage.js";
import { checkHtml, guideHtml } from "../public/public-html.js";
import { publicToolsCss } from "../public/public-css.js";
import { checkJs, guideJs } from "../public/public-js.js";

const checkSchema = z.object({ api_key: z.string().min(12).max(300) });

export async function publicToolsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/guide", { schema: { hide: true } }, async (_request, reply) => reply.type("text/html; charset=utf-8").send(guideHtml));
  app.get("/huongdan", { schema: { hide: true } }, async (_request, reply) => reply.redirect("/guide"));
  app.get("/check", { schema: { hide: true } }, async (_request, reply) => reply.type("text/html; charset=utf-8").send(checkHtml));
  app.get("/public-tools.css", { schema: { hide: true } }, async (_request, reply) => reply.type("text/css; charset=utf-8").send(publicToolsCss));
  app.get("/guide.js", { schema: { hide: true } }, async (_request, reply) => reply.type("text/javascript; charset=utf-8").send(guideJs));
  app.get("/check.js", { schema: { hide: true } }, async (_request, reply) => reply.type("text/javascript; charset=utf-8").send(checkJs));

  app.get("/guide/data", async () => ({
    data: {
      base_url: env.PUBLIC_BASE_URL || `http://localhost:${env.GATEWAY_PORT}`,
      capabilities: gatewayCapabilities,
      models: listModelRegistry({ enabledOnly: true }).map((model) => ({
        id: model.provider_model,
        display_name: model.display_name,
        provider: model.provider,
        kind: model.model_kind,
        task_types: model.task_types,
        cost_tier: model.cost_tier,
        health: model.health_status
      }))
    }
  }));

  app.post("/check/api-key", async (request: FastifyRequest, reply) => {
    const allowed = incrementPublicRateLimit({
      scope: "api-key-check",
      identity: request.ip,
      windowMs: 10_000,
      max: 1
    });
    if (!allowed) {
      return reply.code(429).send({ error: { code: "RATE_LIMITED", message: "Vui lòng chờ 10 giây trước khi kiểm tra lại." } });
    }

    const parsed = checkSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: "INVALID_REQUEST", message: "API key không đúng định dạng." } });
    }
    const body = parsed.data;
    const context = inspectApiKeyContext(body.api_key);
    if (!context) {
      return reply.code(401).send({ error: { code: "INVALID_API_KEY", message: "API key không hợp lệ, đã bị thu hồi hoặc đã hết hạn." } });
    }

    const monthStart = `${new Date().toISOString().slice(0, 7)}-01`;
    const usage = getApiKeyUsageSince(context.apiKey.id, monthStart);
    return {
      data: {
        key_prefix: context.apiKey.key_prefix,
        key_name: context.apiKey.name,
        client_name: context.client.name,
        expires_at: context.apiKey.expires_at,
        policy: {
          allowed_models: context.policy.allowedModels,
          allowed_task_types: context.policy.allowedTaskTypes,
          allowed_providers: context.policy.allowedProviders,
          allowed_cost_tiers: context.policy.allowedCostTiers,
          source: context.policy.source
        },
        quota: {
          rate_limit_per_minute: context.policy.rateLimitPerMinute,
          daily_request_limit: context.policy.dailyRequestLimit,
          monthly_token_limit: context.policy.monthlyTokenLimit
        },
        usage
      }
    };
  });
}
