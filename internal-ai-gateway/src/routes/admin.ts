import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { adminTokenAuth, cookieValue, createAdminSession, revokeAdminSession, verifyAdminToken } from "../admin/admin-auth.js";
import { adminHtml } from "../admin/dashboard-html.js";
import { adminCss } from "../admin/dashboard-css.js";
import { adminJs } from "../admin/dashboard-js.js";
import {
  clearPublicRateLimit,
  incrementPublicRateLimit,
  isPublicRateLimitBlocked
} from "../auth/public-rate-limit.js";
import { gatewayCapabilities } from "../config/capabilities.js";
import { env } from "../config/env.js";
import { listGatewayModels, modelRoutes } from "../config/models.js";
import { createSqliteBackup, exportDatabaseJson } from "../db/backup.js";
import { getDb } from "../db/client.js";
import { buildClientConfig } from "./client-config.js";
import { listAdminAuditLogs, recordAdminAction } from "../db/repositories/admin-audit.js";
import { createApiKey, findApiKeyContextById, listApiKeys, revokeApiKey, rotateApiKey } from "../db/repositories/api-keys.js";
import { getProviderHealthStats, listAuditLogs, listAuditLogsPaginated } from "../db/repositories/audit-logs.js";
import {
  listModelRegistry,
  listProviderHealthSummary,
  selectBestModelForTask,
  updateModelHealth,
  updateModelRegistry,
  updateProviderModels,
  upsertScannedModels
} from "../db/repositories/model-registry.js";
import { listPolicies, upsertPolicy } from "../db/repositories/policies.js";
import { listRoutingRules, selectRoutingRuleForContext, upsertRoutingRule } from "../db/repositories/routing-rules.js";
import { getApiKeyUsage, getUsageSummary, listUsageDaily } from "../db/repositories/usage.js";
import { createClient, createUser, listClients, listUsers, updateClientStatus, updateUserStatus } from "../db/repositories/users.js";
import { createWebhook, deleteWebhook, listWebhooks, updateWebhook, WEBHOOK_EVENTS } from "../db/repositories/webhooks.js";
import { GatewayError } from "../errors/gateway-error.js";
import { assertSafeWebhookUrl } from "../observability/webhook-url.js";
import { listNineRouterModels, testNineRouterConnection } from "../providers/nine-router.js";
import { resolveSmartModelRoute } from "../router/model-router.js";

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(["owner", "admin", "member", "service"]).default("service")
});

const createClientSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["human", "service", "workflow", "spa-system", "coding-tool"]),
  ownerUserId: z.string().min(1)
});

const statusSchema = z.object({
  status: z.enum(["active", "suspended"])
});

const createKeySchema = z.object({
  userId: z.string().min(1),
  clientId: z.string().min(1),
  name: z.string().min(1),
  mode: z.enum(["live", "test"]).default("live"),
  expiresAt: z.string().datetime().nullable().optional()
});

const policySchema = z.object({
  scopeType: z.enum(["global", "user", "client", "api_key"]),
  scopeId: z.string().min(1),
  allowedModels: z.array(z.string().min(1)).min(1),
  allowedTaskTypes: z.array(z.string().min(1)).min(1),
  allowedProviders: z.array(z.enum(["anthropic", "openai", "kiro-cli", "9router"])).optional(),
  allowedCostTiers: z.array(z.enum(["cheap", "balanced", "strong"])).optional(),
  rateLimitPerMinute: z.number().int().positive(),
  dailyRequestLimit: z.number().int().positive().nullable().optional(),
  monthlyTokenLimit: z.number().int().positive().nullable().optional(),
  maxInputCharacters: z.number().int().positive(),
  allowTools: z.boolean().default(false),
  logPrompts: z.boolean().default(false)
});

const updateModelRegistrySchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean().optional(),
  priority: z.number().int().min(0).max(200).optional(),
  taskTypes: z.array(z.enum(gatewayCapabilities)).optional(),
  tags: z.array(z.string().min(1)).optional()
});

const updateModelHealthSchema = z.object({
  healthStatus: z.enum(["unknown", "healthy", "degraded", "down"]),
  avgLatencyMs: z.number().int().nonnegative().nullable().optional(),
  errorCount: z.number().int().nonnegative().optional(),
  lastErrorAt: z.string().datetime().nullable().optional()
});

const routingRuleSchema = z.object({
  scopeType: z.enum(["global", "user", "client", "api_key"]),
  scopeId: z.string().min(1),
  capability: z.enum(gatewayCapabilities),
  provider: z.enum(["anthropic", "openai", "kiro-cli", "9router"]),
  providerModel: z.string().min(1),
  modelRegistryId: z.string().nullable().optional(),
  costTier: z.enum(["cheap", "balanced", "strong"]).optional(),
  priority: z.number().int().min(0).max(200).optional(),
  enabled: z.boolean().optional()
});

const loginSchema = z.object({
  adminToken: z.string().min(1)
});

const onboardSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(["owner", "admin", "member", "service"]).default("member"),
  keyName: z.string().min(1).default("default"),
  clientName: z.string().min(1).optional(),
  clientType: z.enum(["human", "service", "workflow", "spa-system", "coding-tool"]).default("human"),
  keyMode: z.enum(["live", "test"]).default("live"),
  createPolicy: z.boolean().default(true),
  allowedModels: z.array(z.string().min(1)).default(["auto", "cheap-chat", "strong-code", "spa-assistant"]),
  allowedTaskTypes: z.array(z.enum(gatewayCapabilities)).default(["chat", "coding", "review", "workflow", "spa-chat"]),
  allowedProviders: z.array(z.enum(["anthropic", "openai", "kiro-cli", "9router"])).default([]),
  allowedCostTiers: z.array(z.enum(["cheap", "balanced", "strong"])).default([]),
  rateLimitPerMinute: z.number().int().positive().default(60),
  dailyRequestLimit: z.number().int().positive().nullable().optional(),
  monthlyTokenLimit: z.number().int().positive().nullable().optional(),
  maxInputCharacters: z.number().int().positive().default(60000),
  allowTools: z.boolean().default(false),
  logPrompts: z.boolean().default(false),
  configClient: z.enum(["claude-code", "cursor", "n8n", "ai-spa"]).default("cursor")
});

const usageSummaryQuerySchema = z.object({
  days: z.coerce.number().int().positive().max(90).optional(),
  groupBy: z.enum(["date", "client", "model", "provider"]).optional()
});

const usageDaysQuerySchema = z.object({
  days: z.coerce.number().int().positive().max(90).optional()
});

const routeDryRunSchema = z.object({
  apiKeyId: z.string().min(1),
  model: z.string().min(1).default("auto"),
  taskType: z.enum(gatewayCapabilities).default("chat")
});

const providerOpsSchema = z.object({
  provider: z.enum(["anthropic", "openai", "kiro-cli", "9router"]),
  enabled: z.boolean().optional(),
  priority: z.number().int().min(0).max(200).optional(),
  reason: z.string().min(3).max(240)
});

const ADMIN_LOGIN_WINDOW_MS = 5 * 60 * 1000;
const ADMIN_LOGIN_MAX_ATTEMPTS = 5;

function adminControlCenter() {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const monthStart = `${new Date().toISOString().slice(0, 7)}-01`;

  const scalar = <T>(sql: string, key: string, params: Array<string | number | bigint | null> = []) =>
    (db.prepare(sql).get(...params) as Record<string, T> | undefined)?.[key];

  const todayUsage = db
    .prepare(
      `SELECT
         COALESCE(SUM(request_count), 0) AS requests,
         COALESCE(SUM(input_tokens + output_tokens), 0) AS tokens,
         COALESCE(SUM(estimated_cost), 0) AS cost
       FROM usage_daily
       WHERE date = ?`
    )
    .get(today) as { requests: number; tokens: number; cost: number };

  const monthUsage = db
    .prepare(
      `SELECT
         COALESCE(SUM(request_count), 0) AS requests,
         COALESCE(SUM(input_tokens + output_tokens), 0) AS tokens,
         COALESCE(SUM(estimated_cost), 0) AS cost
       FROM usage_daily
       WHERE date >= ?`
    )
    .get(monthStart) as { requests: number; tokens: number; cost: number };

  const errorStats = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         COALESCE(SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END), 0) AS errors,
         COALESCE(AVG(latency_ms), 0) AS avg_latency_ms
       FROM audit_logs
       WHERE created_at >= ?`
    )
    .get(dayAgo) as { total: number; errors: number; avg_latency_ms: number };

  const latencyRows = db
    .prepare("SELECT latency_ms FROM audit_logs WHERE created_at >= ? ORDER BY latency_ms")
    .all(dayAgo) as Array<{ latency_ms: number }>;
  const p95Index = latencyRows.length ? Math.min(latencyRows.length - 1, Math.ceil(latencyRows.length * 0.95) - 1) : -1;
  const p95LatencyMs = p95Index >= 0 ? latencyRows[p95Index].latency_ms : 0;

  const alerts = db
    .prepare(
      `SELECT 'provider_error' AS type, provider AS subject, error_code AS detail, created_at, 'high' AS severity
       FROM audit_logs
       WHERE status = 'error' AND created_at >= ?
       UNION ALL
       SELECT 'admin_action' AS type, action AS subject, target_type || ':' || COALESCE(target_id, '') AS detail, created_at, 'info' AS severity
       FROM admin_audit_logs
       WHERE created_at >= ?
       ORDER BY created_at DESC
       LIMIT 20`
    )
    .all(dayAgo, dayAgo);

  const topClients = db
    .prepare(
      `SELECT client_id, COALESCE(SUM(request_count), 0) AS requests, COALESCE(SUM(estimated_cost), 0) AS cost
       FROM usage_daily
       WHERE date >= ?
       GROUP BY client_id
       ORDER BY requests DESC
       LIMIT 8`
    )
    .all(monthStart);

  const topUsers = db
    .prepare(
      `SELECT user_id, COALESCE(SUM(request_count), 0) AS requests, COALESCE(SUM(estimated_cost), 0) AS cost
       FROM usage_daily
       WHERE date >= ?
       GROUP BY user_id
       ORDER BY requests DESC
       LIMIT 8`
    )
    .all(monthStart);

  return {
    today,
    totals: {
      users: scalar<number>("SELECT COUNT(*) AS total FROM users", "total") ?? 0,
      clients: scalar<number>("SELECT COUNT(*) AS total FROM clients", "total") ?? 0,
      active_api_keys: scalar<number>("SELECT COUNT(*) AS total FROM api_keys WHERE status = 'active'", "total") ?? 0,
      enabled_models: scalar<number>("SELECT COUNT(*) AS total FROM model_registry WHERE enabled = 1", "total") ?? 0
    },
    today_usage: todayUsage,
    month_usage: monthUsage,
	    reliability_24h: {
	      total: errorStats.total,
	      error_count: errorStats.errors,
	      error_rate: errorStats.total ? Number(((errorStats.errors / errorStats.total) * 100).toFixed(2)) : 0,
	      avg_latency_ms: Math.round(errorStats.avg_latency_ms || 0),
	      p95_latency_ms: p95LatencyMs
	    },
    alerts,
    top_clients: topClients,
    top_users: topUsers
  };
}

function injectApiKey<T>(value: T, rawKey: string): T {
  if (typeof value === "string") {
    return value.replaceAll("<gateway-api-key>", rawKey) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => injectApiKey(item, rawKey)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, injectApiKey(item, rawKey)])
    ) as T;
  }
  return value;
}

function dryRunDecision(model: string, taskType: (typeof gatewayCapabilities)[number], context: NonNullable<ReturnType<typeof findApiKeyContextById>>) {
  if (model !== "auto") {
    const alias = modelRoutes.find((route) => route.model === model);
    return {
      source: alias ? "explicit_alias" : "explicit_unknown",
      routing_rule: null,
      registry_model: null,
      fallback_alias: null
    };
  }

  const rule = selectRoutingRuleForContext({
    apiKeyId: context.apiKey.id,
    clientId: context.client.id,
    userId: context.user.id,
    capability: taskType
  });
  if (rule) {
    return {
      source: "routing_rule",
      routing_rule: rule,
      registry_model: null,
      fallback_alias: null
    };
  }

  const registryModel = selectBestModelForTask(taskType, context.policy.allowedModels);
  if (registryModel) {
    return {
      source: "model_registry",
      routing_rule: null,
      registry_model: registryModel,
      fallback_alias: null
    };
  }

  const fallbackAlias =
    taskType === "coding" || taskType === "review" || taskType === "test-generation" || taskType === "repo-analysis"
      ? "strong-code"
      : taskType === "spa-chat" && context.policy.allowedModels.includes("spa-assistant")
        ? "spa-assistant"
        : "cheap-chat";

  return {
    source: "fallback_alias",
    routing_rule: null,
    registry_model: null,
    fallback_alias: fallbackAlias
  };
}

function adminCookie(token: string, maxAge: number): string {
  const secure = process.env.NODE_ENV === "production" || env.PUBLIC_BASE_URL?.startsWith("https://");
  return `admin_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

function assertAdminLoginAllowed(ip: string): void {
  const blocked = isPublicRateLimitBlocked({
    scope: "admin-login",
    identity: ip,
    windowMs: ADMIN_LOGIN_WINDOW_MS,
    max: ADMIN_LOGIN_MAX_ATTEMPTS
  });
  if (blocked) {
    throw new GatewayError("RATE_LIMITED", "Too many admin login attempts", 429);
  }
}

function recordAdminLoginFailure(ip: string): void {
  incrementPublicRateLimit({
    scope: "admin-login",
    identity: ip,
    windowMs: ADMIN_LOGIN_WINDOW_MS,
    max: ADMIN_LOGIN_MAX_ATTEMPTS
  });
}

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.get("/admin", { schema: { hide: true } }, async (_request, reply) => reply.type("text/html; charset=utf-8").send(adminHtml));
  app.get("/admin/app.css", { schema: { hide: true } }, async (_request, reply) => reply.header("Cache-Control", "no-store").type("text/css; charset=utf-8").send(adminCss));
  app.get("/admin/app.js", { schema: { hide: true } }, async (_request, reply) => reply.header("Cache-Control", "no-store").type("text/javascript; charset=utf-8").send(adminJs));

  app.post("/admin/api/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const ip = request.ip;
    assertAdminLoginAllowed(ip);
    if (!verifyAdminToken(body.adminToken)) {
      recordAdminLoginFailure(ip);
      throw new GatewayError("UNAUTHORIZED", "Invalid admin token", 401);
    }
    clearPublicRateLimit("admin-login", ip);
    const session = createAdminSession();
    reply.header("set-cookie", adminCookie(session.token, session.maxAge));
    return { data: session };
  });

  app.post("/admin/api/logout", async (request, reply) => {
    const header = request.headers["x-admin-session"];
    const rawSession = Array.isArray(header) ? header[0] : header;
    const sessionToken = rawSession ?? cookieValue(request.headers.cookie, "admin_session");
    if (sessionToken) revokeAdminSession(sessionToken);
    reply.header("set-cookie", adminCookie("", 0));
    return { data: { ok: true } };
  });

  // POST /admin/api/onboard — create user + client + key in one step
  app.post("/admin/api/onboard", { preHandler: adminTokenAuth }, async (request) => {
    const body = onboardSchema.parse(request.body);
    const user = createUser({ email: body.email, name: body.name, role: body.role });
    const client = createClient({ name: body.clientName ?? body.name, type: body.clientType, ownerUserId: user.id });
    const apiKey = createApiKey({ userId: user.id, clientId: client.id, name: body.keyName, mode: body.keyMode });
    const policy = body.createPolicy
      ? upsertPolicy({
          scopeType: "api_key",
          scopeId: apiKey.id,
          allowedModels: body.allowedModels,
          allowedTaskTypes: body.allowedTaskTypes,
          allowedProviders: body.allowedProviders,
          allowedCostTiers: body.allowedCostTiers,
          rateLimitPerMinute: body.rateLimitPerMinute,
          dailyRequestLimit: body.dailyRequestLimit,
          monthlyTokenLimit: body.monthlyTokenLimit,
          maxInputCharacters: body.maxInputCharacters,
          allowTools: body.allowTools,
          logPrompts: body.logPrompts
        })
      : null;
    const clientConfig = injectApiKey(buildClientConfig(body.configClient), apiKey.raw_key);
    recordAdminAction({
      action: "onboard.created",
      targetType: "user",
      targetId: user.id,
      metadata: { client_id: client.id, api_key_id: apiKey.id, policy_id: policy?.id ?? null, email: user.email }
    });
    return { data: { user, client, apiKey, policy, clientConfig } };
  });

  app.get("/admin/api/users", { preHandler: adminTokenAuth }, async () => ({ data: listUsers() }));
  app.post("/admin/api/users", { preHandler: adminTokenAuth }, async (request) => {
    const user = createUser(createUserSchema.parse(request.body));
    recordAdminAction({ action: "user.created", targetType: "user", targetId: user.id, metadata: { email: user.email } });
    return { data: user };
  });
  app.patch("/admin/api/users/:id", { preHandler: adminTokenAuth }, async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const updated = updateUserStatus(params.id, statusSchema.parse(request.body).status);
    if (!updated) throw new GatewayError("INVALID_REQUEST", "User not found", 404);
    recordAdminAction({ action: "user.status_updated", targetType: "user", targetId: updated.id, metadata: { status: updated.status } });
    return { data: updated };
  });

  app.get("/admin/api/clients", { preHandler: adminTokenAuth }, async () => ({ data: listClients() }));
  app.post("/admin/api/clients", { preHandler: adminTokenAuth }, async (request) => {
    const client = createClient(createClientSchema.parse(request.body));
    recordAdminAction({ action: "client.created", targetType: "client", targetId: client.id, metadata: { type: client.type } });
    return { data: client };
  });
  app.patch("/admin/api/clients/:id", { preHandler: adminTokenAuth }, async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const updated = updateClientStatus(params.id, statusSchema.parse(request.body).status);
    if (!updated) throw new GatewayError("INVALID_REQUEST", "Client not found", 404);
    recordAdminAction({ action: "client.status_updated", targetType: "client", targetId: updated.id, metadata: { status: updated.status } });
    return { data: updated };
  });

  app.get("/admin/api/api-keys", { preHandler: adminTokenAuth }, async () => ({ data: listApiKeys() }));
  app.post("/admin/api/api-keys", { preHandler: adminTokenAuth }, async (request) => {
    const key = createApiKey(createKeySchema.parse(request.body));
    recordAdminAction({ action: "api_key.created", targetType: "api_key", targetId: key.id, metadata: { user_id: key.user_id, client_id: key.client_id } });
    return { data: key };
  });
  app.post("/admin/api/api-keys/:id/revoke", { preHandler: adminTokenAuth }, async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const updated = revokeApiKey(params.id);
    if (!updated) throw new GatewayError("INVALID_REQUEST", "API key not found", 404);
    recordAdminAction({ action: "api_key.revoked", targetType: "api_key", targetId: updated.id });
    return { data: updated };
  });
  app.post("/admin/api/api-keys/:id/rotate", { preHandler: adminTokenAuth }, async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const updated = rotateApiKey(params.id);
    if (!updated) throw new GatewayError("INVALID_REQUEST", "API key not found", 404);
    recordAdminAction({ action: "api_key.rotated", targetType: "api_key", targetId: updated.id });
    return { data: updated };
  });
  app.get("/admin/api/api-keys/:id/usage", { preHandler: adminTokenAuth }, async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const query = usageDaysQuerySchema.parse(request.query);
    return { data: getApiKeyUsage(params.id, query.days) };
  });

  app.get("/admin/api/policies", { preHandler: adminTokenAuth }, async () => ({ data: listPolicies() }));
  app.put("/admin/api/policies", { preHandler: adminTokenAuth }, async (request) => {
    const policy = upsertPolicy(policySchema.parse(request.body));
    recordAdminAction({
      action: "policy.upserted",
      targetType: "policy",
      targetId: policy.id,
      metadata: { scope_type: policy.scope_type, scope_id: policy.scope_id }
    });
    return { data: policy };
  });
  app.get("/admin/api/admin-audit-logs", { preHandler: adminTokenAuth }, async () => ({ data: listAdminAuditLogs() }));
  app.get("/admin/api/audit-logs", { preHandler: adminTokenAuth }, async (request) => {
    const q = request.query as Record<string, string>;
    return listAuditLogsPaginated({
      page: q.page ? parseInt(q.page, 10) : 1,
      limit: q.limit ? parseInt(q.limit, 10) : 50,
      status: q.status === "ok" || q.status === "error" ? q.status : undefined,
      model: q.model || undefined,
      provider: q.provider || undefined,
      from: q.from || undefined,
      to: q.to || undefined
    });
  });
  app.get("/admin/api/audit-logs/all", { preHandler: adminTokenAuth }, async () => ({ data: listAuditLogs() }));
  app.get("/admin/api/provider-health/recent", { preHandler: adminTokenAuth }, async () => ({
    data: getProviderHealthStats()
  }));
  app.get("/admin/api/control-center", { preHandler: adminTokenAuth }, async () => ({ data: adminControlCenter() }));
  app.get("/admin/api/usage/daily", { preHandler: adminTokenAuth }, async () => ({ data: listUsageDaily() }));
  app.get("/admin/api/usage/summary", { preHandler: adminTokenAuth }, async (request) => ({
    data: getUsageSummary(usageSummaryQuerySchema.parse(request.query))
  }));
  app.get("/admin/api/models", { preHandler: adminTokenAuth }, async () => ({ data: listGatewayModels() }));
  app.get("/admin/api/model-registry", { preHandler: adminTokenAuth }, async () => ({ data: listModelRegistry() }));
  app.get("/admin/api/provider-health", { preHandler: adminTokenAuth }, async () => ({ data: listProviderHealthSummary() }));
  app.post("/admin/api/model-registry/scan", { preHandler: adminTokenAuth }, async () => {
    const models = await listNineRouterModels();
    return { data: upsertScannedModels("9router", models), scanned: models.length };
  });
  app.patch("/admin/api/model-registry", { preHandler: adminTokenAuth }, async (request) => {
    const body = updateModelRegistrySchema.parse(request.body);
    const updated = updateModelRegistry(body.id, body);
    if (!updated) throw new GatewayError("INVALID_REQUEST", "Model registry row not found", 404);
    recordAdminAction({ action: "model_registry.updated", targetType: "model", targetId: updated.id });
    return { data: updated };
  });
  app.patch("/admin/api/model-registry/:id/health", { preHandler: adminTokenAuth }, async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = updateModelHealthSchema.parse(request.body);
    const updated = updateModelHealth(params.id, {
      healthStatus: body.healthStatus,
      avgLatencyMs: body.avgLatencyMs,
      errorCount: body.errorCount,
      lastErrorAt: body.lastErrorAt
    });
    if (!updated) throw new GatewayError("INVALID_REQUEST", "Model registry row not found", 404);
    recordAdminAction({ action: "model_health.updated", targetType: "model", targetId: updated.id, metadata: { health_status: updated.health_status } });
    return { data: updated };
  });
  app.patch("/admin/api/provider-ops", { preHandler: adminTokenAuth }, async (request) => {
    const body = providerOpsSchema.parse(request.body);
    const result = updateProviderModels(body.provider, { enabled: body.enabled, priority: body.priority });
    recordAdminAction({
      action: "provider.bulk_updated",
      targetType: "provider",
      targetId: body.provider,
      metadata: { enabled: body.enabled ?? null, priority: body.priority ?? null, reason: body.reason, updated: result.updated }
    });
    return { data: result };
  });
  app.get("/admin/api/routing-rules", { preHandler: adminTokenAuth }, async () => ({ data: listRoutingRules() }));
  app.put("/admin/api/routing-rules", { preHandler: adminTokenAuth }, async (request) => ({
    data: (() => {
      const rule = upsertRoutingRule(routingRuleSchema.parse(request.body));
      recordAdminAction({ action: "routing_rule.upserted", targetType: "routing_rule", targetId: rule.id, metadata: { capability: rule.capability } });
      return rule;
    })()
  }));
  app.post("/admin/api/routing/dry-run", { preHandler: adminTokenAuth }, async (request) => {
    const body = routeDryRunSchema.parse(request.body);
    const context = findApiKeyContextById(body.apiKeyId);
    if (!context) throw new GatewayError("INVALID_REQUEST", "Active API key context not found", 404);
    const decision = dryRunDecision(body.model, body.taskType, context);
    const route = resolveSmartModelRoute(body.model, body.taskType, context);
    return {
      data: {
        api_key_id: context.apiKey.id,
        user_id: context.user.id,
        client_id: context.client.id,
        policy_source: context.policy.source,
        policy: {
          allowed_models: context.policy.allowedModels,
          allowed_task_types: context.policy.allowedTaskTypes,
          allowed_providers: context.policy.allowedProviders,
          allowed_cost_tiers: context.policy.allowedCostTiers,
          rate_limit_per_minute: context.policy.rateLimitPerMinute,
          daily_request_limit: context.policy.dailyRequestLimit,
          monthly_token_limit: context.policy.monthlyTokenLimit,
          max_input_characters: context.policy.maxInputCharacters,
          allow_tools: context.policy.allowTools,
          log_prompts: context.policy.logPrompts
        },
        decision,
        requested_model: body.model,
        task_type: body.taskType,
        resolved_model: route.model,
        provider: route.provider,
        provider_model: route.providerModel
      }
    };
  });
  app.get("/admin/api/analytics/overview", { preHandler: adminTokenAuth }, async (request) => {
    const q = request.query as Record<string, string>;
    const days = Math.min(parseInt(q.days || "30", 10), 90);

    type SummaryRow = {
      bucket: string | null;
      request_count: number;
      input_tokens: number;
      output_tokens: number;
      estimated_cost: number;
    };
    const mapRows = (rows: unknown[], key: string) =>
      (rows as SummaryRow[]).map((r) => ({
        [key]: r.bucket,
        request_count: r.request_count,
        input_tokens: r.input_tokens,
        output_tokens: r.output_tokens,
        total_input_tokens: r.input_tokens,
        total_output_tokens: r.output_tokens,
        total_requests: r.request_count,
        total_cost: r.estimated_cost,
        estimated_cost: r.estimated_cost
      }));

    const byDate = getUsageSummary({ days, groupBy: "date" });
    const byProvider = getUsageSummary({ days, groupBy: "provider" });
    const byModel = getUsageSummary({ days, groupBy: "model" });

    return {
      by_date: mapRows(byDate, "date").sort((a, b) =>
        String(a.date ?? "").localeCompare(String(b.date ?? ""))
      ),
      by_provider: mapRows(byProvider, "provider"),
      by_model: mapRows(byModel, "model")
    };
  });
  app.post("/admin/api/database/backup", { preHandler: adminTokenAuth }, async () => {
    const backup = createSqliteBackup();
    recordAdminAction({ action: "database.backup_created", targetType: "database", targetId: "sqlite", metadata: { path: backup.path, bytes: backup.bytes } });
    return { data: backup };
  });
  app.get("/admin/api/database/export", { preHandler: adminTokenAuth }, async () => ({ data: exportDatabaseJson() }));
  app.post("/admin/api/providers/9router/test", { preHandler: adminTokenAuth }, async () => ({ data: await testNineRouterConnection() }));

  const webhookSchema = z.object({
    name: z.string().min(1),
    url: z.string().url(),
    events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
    secret: z.string().optional()
  });

  app.get("/admin/api/webhooks", { preHandler: adminTokenAuth }, async () => ({ data: listWebhooks() }));
  app.post("/admin/api/webhooks", { preHandler: adminTokenAuth }, async (request) => {
    const body = webhookSchema.parse(request.body);
    await assertSafeWebhookUrl(body.url);
    const hook = createWebhook(body);
    recordAdminAction({ action: "webhook.created", targetType: "webhook", targetId: hook.id });
    const { secret: _secret, ...safeHook } = hook;
    return { data: { ...safeHook, secret_configured: Boolean(hook.secret) } };
  });
  app.patch("/admin/api/webhooks/:id", { preHandler: adminTokenAuth }, async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = webhookSchema
      .partial()
      .extend({ enabled: z.boolean().optional() })
      .parse(request.body);
    if (body.url) await assertSafeWebhookUrl(body.url);
    const updated = updateWebhook(params.id, body);
    if (!updated) throw new GatewayError("INVALID_REQUEST", "Webhook not found", 404);
    recordAdminAction({ action: "webhook.updated", targetType: "webhook", targetId: updated.id });
    const { secret: _secret, ...safeHook } = updated;
    return { data: { ...safeHook, secret_configured: Boolean(updated.secret) } };
  });
  app.delete("/admin/api/webhooks/:id", { preHandler: adminTokenAuth }, async (request) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const ok = deleteWebhook(params.id);
    if (!ok) throw new GatewayError("INVALID_REQUEST", "Webhook not found", 404);
    recordAdminAction({ action: "webhook.deleted", targetType: "webhook", targetId: params.id });
    return { data: { ok: true } };
  });
}
