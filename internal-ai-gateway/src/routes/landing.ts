import type { FastifyInstance, FastifyRequest } from "fastify";
import { nanoid } from "nanoid";
import { z } from "zod";
import { incrementPublicRateLimit } from "../auth/public-rate-limit.js";
import { gatewayCapabilities } from "../config/capabilities.js";
import { env } from "../config/env.js";
import { getDb } from "../db/client.js";
import { listModelRegistry } from "../db/repositories/model-registry.js";
import { getUsageSummary } from "../db/repositories/usage.js";
import { landingHtml } from "../landing/landing-html.js";
import { landingCss } from "../landing/landing-css.js";
import { landingJs } from "../landing/landing-js.js";

const DEMO_RATE_LIMIT_MS = 3000;
const LANDING_TRACK_WINDOW_MS = 60_000;
const LANDING_TRACK_MAX_EVENTS = 30;
const landingEventSchema = z.object({
  event: z.enum(["cta_dashboard", "cta_admin", "cta_catalog", "demo_submit", "integration_tab", "theme_change"]),
  path: z
    .string()
    .max(120)
    .default("/")
    .transform((path) => path.trim())
    .refine((path) => path.startsWith("/") && !/[\r\n\t]/.test(path), "Invalid path")
});

function providerConfig() {
  return {
    anthropic: Boolean(env.ANTHROPIC_API_KEY),
    openai: Boolean(env.OPENAI_API_KEY),
    "kiro-cli": Boolean(env.KIRO_API_KEY),
    "9router": Boolean(env.NINEROUTER_BASE_URL)
  };
}

function assertLandingTrackAllowed(ip: string): void {
  const allowed = incrementPublicRateLimit({
    scope: "landing-track",
    identity: ip,
    windowMs: LANDING_TRACK_WINDOW_MS,
    max: LANDING_TRACK_MAX_EVENTS
  });
  if (!allowed) {
    throw new Error("landing track rate limit exceeded");
  }
}

function isLandingDemoAllowed(ip: string): boolean {
  return incrementPublicRateLimit({
    scope: "landing-demo",
    identity: ip,
    windowMs: DEMO_RATE_LIMIT_MS,
    max: 1
  });
}

export async function landingRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", { schema: { hide: true } }, async (_req, reply) => reply.type("text/html; charset=utf-8").send(landingHtml));
  app.get("/landing.css", { schema: { hide: true } }, async (_req, reply) => reply.type("text/css; charset=utf-8").send(landingCss));
  app.get("/landing.js", { schema: { hide: true } }, async (_req, reply) => reply.type("text/javascript; charset=utf-8").send(landingJs));

  app.get("/landing/status", async () => {
    const models = listModelRegistry({ enabledOnly: true });
    const usage = getUsageSummary({ days: 7, groupBy: "date" }) as Array<{
      bucket: string;
      request_count: number;
      input_tokens: number;
      output_tokens: number;
      estimated_cost: number;
    }>;
    const providers = providerConfig();
    const taskTypes = new Set(models.flatMap((model) => model.task_types));

    return {
      data: {
        status: "ready",
        checked_at: new Date().toISOString(),
        database: env.DATABASE_PROVIDER,
        providers,
        provider_count: Object.values(providers).filter(Boolean).length,
        model_count: models.length,
        capabilities: gatewayCapabilities,
        active_capabilities: [...taskTypes],
        models: models.slice(0, 18).map((model) => ({
          id: model.provider_model,
          kind: model.model_kind,
          task_types: model.task_types,
          cost_tier: model.cost_tier,
          health: model.health_status
        })),
        usage_7d: usage
      }
    };
  });

  app.post("/landing/track", async (request, reply) => {
    try {
      assertLandingTrackAllowed(request.ip);
    } catch {
      return reply.code(204).send();
    }
    const body = landingEventSchema.parse(request.body);
    getDb()
      .prepare("INSERT INTO landing_events (id, event_name, path, created_at) VALUES (?, ?, ?, ?)")
      .run(`lev_${nanoid(12)}`, body.event, body.path, new Date().toISOString());
    return reply.code(204).send();
  });

  app.post("/landing/demo", async (request: FastifyRequest, reply) => {
    const ip = request.ip;
    if (!isLandingDemoAllowed(ip)) {
      return reply.code(429).send({ error: "rate limited — wait 3s between requests" });
    }

    const body = request.body as Record<string, unknown>;
    const prompt = String(body?.prompt ?? "").slice(0, 300).trim();
    if (!prompt) return reply.code(400).send({ error: "empty prompt" });

    // simulate ~300-600ms gateway latency
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 300));

    const answers = [
      "Sandbox demo accepted the request. Production traffic uses your API key policy, routing rules, quota, audit log, and configured provider credentials.",
      "The gateway supports model=auto. It resolves a routing rule first, then selects an enabled registry model for the requested capability.",
      "Client applications use one gateway key. Raw keys are shown once, stored as scrypt hashes, and can be rotated or revoked from Admin.",
      "Every production request receives an x-request-id and writes latency, token usage, provider metadata, status, and estimated cost to the audit store."
    ];
    const answer = answers[Math.floor(Math.random() * answers.length)];
    const inputTokens = Math.max(8, Math.round(prompt.split(" ").length * 1.4));
    const outputTokens = Math.round(answer.split(" ").length * 1.4);

    return reply.send({
      model: "auto",
      provider: "sandbox",
      latency_ms: Math.round(300 + Math.random() * 300),
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      response: answer,
    });
  });
}
