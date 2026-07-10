import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";
import { getDb } from "../db/client.js";
import { listProviderHealthSummary } from "../db/repositories/model-registry.js";

function providerConfig() {
  return {
    anthropic: Boolean(env.ANTHROPIC_API_KEY),
    openai: Boolean(env.OPENAI_API_KEY),
    "kiro-cli": Boolean(env.KIRO_API_KEY),
    "9router": Boolean(env.NINEROUTER_BASE_URL)
  };
}

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", {
    schema: {
      tags: ["Health"],
      summary: "Gateway health check",
      response: { 200: { type: "object", properties: { status: { type: "string" } } } }
    }
  }, async () => ({
    status: "ok"
  }));

  app.get("/ready", async () => ({
    status: "ready",
    providers: providerConfig()
  }));

  app.get("/ready/details", async () => ({
    status: "ready",
    checked_at: new Date().toISOString(),
    database: {
      provider: env.DATABASE_PROVIDER,
      ok: Boolean(getDb().prepare("SELECT 1 AS ok").get())
    },
    limits: {
      request_body_limit_bytes: env.REQUEST_BODY_LIMIT_BYTES
    },
    providers: providerConfig(),
    model_health: listProviderHealthSummary()
  }));
}
