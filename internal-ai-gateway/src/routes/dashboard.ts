import type { FastifyInstance } from "fastify";
import { apiKeyAuth } from "../auth/api-key-auth.js";
import { dashboardHtml } from "../dashboard/dashboard-html.js";
import { dashboardCss } from "../dashboard/dashboard-css.js";
import { dashboardJs } from "../dashboard/dashboard-js.js";
import { getDb } from "../db/client.js";
import { listAuditLogsPaginated } from "../db/repositories/audit-logs.js";
import { createApiKey } from "../db/repositories/api-keys.js";
import { getMonthlyTokenCountForUser, getDailyRequestCountForApiKey } from "../db/repositories/usage.js";
import { listGatewayModels } from "../config/models.js";
import { GatewayError } from "../errors/gateway-error.js";
import { resolveSmartModelRoute } from "../router/model-router.js";
import { gatewayCapabilities, type GatewayCapability } from "../config/capabilities.js";
import { z } from "zod";

const dashboardToolSchema = z.object({
  tool: z.enum(["claude-code", "cursor", "n8n", "ai-spa"])
});
const diagnosticQuerySchema = z.object({
  mode: z.enum(["economy", "balanced", "quality"]).default("balanced")
});

const toolTask: Record<z.infer<typeof dashboardToolSchema>["tool"], GatewayCapability> = {
  "claude-code": "coding",
  cursor: "coding",
  n8n: "workflow",
  "ai-spa": "spa-chat"
};

function preferredModelForMode(tool: z.infer<typeof dashboardToolSchema>["tool"], mode: "economy" | "balanced" | "quality") {
  if (mode === "balanced") return "auto";
  if (mode === "economy") return "cheap-chat";
  return tool === "claude-code" || tool === "cursor" ? "strong-code" : "auto";
}

type UsageDailyRow = {
  id: string;
  date: string;
  user_id: string | null;
  api_key_id: string | null;
  client_id: string | null;
  provider: string | null;
  model: string | null;
  request_count: number;
  input_tokens: number;
  output_tokens: number;
  estimated_cost: number;
  created_at: string;
  updated_at: string;
};

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  // Serve HTML
  app.get("/dashboard", { schema: { hide: true } }, async (_request, reply) =>
    reply.type("text/html; charset=utf-8").send(dashboardHtml)
  );

  // Serve CSS
  app.get("/dashboard/app.css", { schema: { hide: true } }, async (_request, reply) =>
    reply.header("Cache-Control", "no-store").type("text/css; charset=utf-8").send(dashboardCss)
  );

  // Serve JS
  app.get("/dashboard/app.js", { schema: { hide: true } }, async (_request, reply) =>
    reply.header("Cache-Control", "no-store").type("text/javascript; charset=utf-8").send(dashboardJs)
  );

  // GET /dashboard/api/me — return user, client, policy, apiKey from context
  app.get("/dashboard/api/me", { preHandler: apiKeyAuth }, async (request) => {
    const ctx = request.apiKeyContext!;
    return {
      user: ctx.user,
      client: ctx.client,
      policy: ctx.policy,
      apiKey: {
        id: ctx.apiKey.id,
        key_prefix: ctx.apiKey.key_prefix,
        status: ctx.apiKey.status,
        last_used_at: ctx.apiKey.last_used_at,
        expires_at: ctx.apiKey.expires_at,
        created_at: ctx.apiKey.created_at
      }
    };
  });

  // GET /dashboard/api/my/keys — all API keys for the authenticated user
  app.get("/dashboard/api/my/keys", { preHandler: apiKeyAuth }, async (request) => {
    const ctx = request.apiKeyContext!;
    const rows = getDb()
      .prepare(
        `SELECT id, user_id, client_id, name, key_prefix, status, last_used_at, expires_at, created_at, revoked_at
         FROM api_keys
         WHERE user_id = ?
         ORDER BY created_at DESC`
      )
      .all(ctx.user.id);
    return { data: rows };
  });

  // GET /dashboard/api/my/usage — usage_daily rows for the user, last 30 days
  app.get("/dashboard/api/my/usage", { preHandler: apiKeyAuth }, async (request) => {
    const ctx = request.apiKeyContext!;
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const rows = getDb()
      .prepare(
        `SELECT * FROM usage_daily
         WHERE user_id = ? AND date >= ?
         ORDER BY date DESC, updated_at DESC
         LIMIT 500`
      )
      .all(ctx.user.id, since) as UsageDailyRow[];
    return { data: rows };
  });

  // GET /dashboard/api/my/audit-logs — paginated user audit logs
  app.get("/dashboard/api/my/audit-logs", { preHandler: apiKeyAuth }, async (request) => {
    const ctx = request.apiKeyContext!;
    const q = request.query as Record<string, string>;
    return listAuditLogsPaginated({
      page: q.page ? parseInt(q.page, 10) : 1,
      limit: q.limit ? Math.min(parseInt(q.limit, 10), 100) : 50,
      userId: ctx.user.id
    });
  });

  // GET /dashboard/api/my/rate-limit — current minute bucket usage and limit
  app.get("/dashboard/api/my/rate-limit", { preHandler: apiKeyAuth }, async (request) => {
    const ctx = request.apiKeyContext!;
    const bucket = Math.floor(Date.now() / 60_000);
    const row = getDb()
      .prepare("SELECT count FROM rate_limit_counters WHERE api_key_id = ? AND minute_bucket = ?")
      .get(ctx.apiKey.id, bucket) as { count: number } | undefined;
    return {
      data: {
        current: row?.count ?? 0,
        limit: ctx.policy.rateLimitPerMinute,
        resets_at: new Date((bucket + 1) * 60_000).toISOString()
      }
    };
  });

  // POST /dashboard/api/my/keys — create a new API key for the authenticated user
  app.post("/dashboard/api/my/keys", { preHandler: apiKeyAuth }, async (request) => {
    const ctx = request.apiKeyContext!;
    const body = (request.body as { name?: string }) || {};
    const name = (body.name ?? "").trim();
    if (!name || name.length < 1) {
      throw new GatewayError("INVALID_REQUEST", "Key name is required", 400);
    }
    const result = createApiKey({
      userId: ctx.user.id,
      clientId: ctx.client.id,
      name,
      mode: "live"
    });
    return { data: result };
  });

  // GET /dashboard/api/my/token-budget — monthly token + daily request quota info
  app.get("/dashboard/api/my/token-budget", { preHandler: apiKeyAuth }, async (request) => {
    const ctx = request.apiKeyContext!;
    const monthlyUsed = getMonthlyTokenCountForUser(ctx.user.id);
    const dailyUsed = getDailyRequestCountForApiKey(ctx.apiKey.id);
    const monthlyLimit = ctx.policy.monthlyTokenLimit ?? null;
    const dailyLimit = ctx.policy.dailyRequestLimit ?? null;
    return {
      data: {
        monthly_limit: monthlyLimit,
        monthly_used: monthlyUsed,
        monthly_percent: monthlyLimit ? Math.round((monthlyUsed / monthlyLimit) * 100) : null,
        daily_request_limit: dailyLimit,
        daily_requests_used: dailyUsed,
        daily_percent: dailyLimit ? Math.round((dailyUsed / dailyLimit) * 100) : null
      }
    };
  });

  // GET /dashboard/api/my/models — models allowed by caller's policy
  app.get("/dashboard/api/my/models", { preHandler: apiKeyAuth }, async (request) => {
    const ctx = request.apiKeyContext!;
    const allModels = listGatewayModels();
    const allowed = (ctx.policy.allowedModels ?? []) as string[];
    const filtered = allowed.includes("auto")
      ? allModels
      : allModels.filter((m) => allowed.includes(m.id));
    return { data: filtered };
  });

  app.get("/dashboard/api/my/diagnostics/:tool", { preHandler: apiKeyAuth }, async (request) => {
    const ctx = request.apiKeyContext!;
    const { tool } = dashboardToolSchema.parse(request.params);
    const { mode } = diagnosticQuerySchema.parse(request.query);
    const taskType = toolTask[tool];
    const preferredModel = preferredModelForMode(tool, mode);
    const model = ctx.policy.allowedModels.includes(preferredModel) ? preferredModel : "auto";
    const allowedTasks = ctx.policy.allowedTaskTypes as GatewayCapability[];
    const checks = [
      { id: "authentication", label: "API key", ok: true, detail: `Authenticated as ${ctx.user.email}` },
      { id: "account", label: "Account and client", ok: true, detail: `${ctx.client.name} is active` },
      {
        id: "task",
        label: "Required capability",
        ok: allowedTasks.includes(taskType),
        detail: allowedTasks.includes(taskType)
          ? `${taskType} is allowed`
          : `${taskType} is not included in this key policy`
      }
    ];

    let route: ReturnType<typeof resolveSmartModelRoute> | null = null;
    let routeError: string | null = null;
    try {
      route = resolveSmartModelRoute(model, taskType, ctx);
    } catch (error) {
      routeError = error instanceof Error ? error.message : "No route available";
    }
    checks.push({
      id: "routing",
      label: "Automatic routing",
      ok: Boolean(route),
      detail: route ? `${route.provider} / ${route.providerModel}` : routeError ?? "No route available"
    });

    return {
      data: {
        tool,
        ready: checks.every((check) => check.ok),
        checks,
        route: route
          ? { model, task_type: taskType, provider: route.provider, provider_model: route.providerModel }
          : null,
        available_capabilities: gatewayCapabilities.filter((capability) => allowedTasks.includes(capability))
      }
    };
  });
}
