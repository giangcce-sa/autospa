import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function loadTestServer() {
  vi.resetModules();
  const tempDir = await mkdtemp(join(tmpdir(), "internal-ai-gateway-"));
  const kiroBin = join(tempDir, "kiro-cli");
  const auditLogPath = join(tempDir, "audit.jsonl");
  const databasePath = join(tempDir, "gateway.db");
  const kiroWorkdir = join(tempDir, "kiro-workdir");

  await writeFile(
    kiroBin,
    "#!/bin/sh\nif [ \"$1\" = \"chat\" ]; then echo \"mock kiro response\"; exit 0; fi\necho \"bad command\" >&2\nexit 2\n",
    "utf8"
  );
  await chmod(kiroBin, 0o755);

  process.env.GATEWAY_PORT = "8787";
  process.env.TRUST_PROXY = "false";
  process.env.LOG_LEVEL = "silent";
  process.env.PUBLIC_BASE_URL = "https://somail.us";
  process.env.MAX_MEDIA_BASE64_BYTES = "8";
  process.env.AUDIT_LOG_PATH = auditLogPath;
  process.env.DATABASE_PROVIDER = "sqlite";
  process.env.DATABASE_URL = `file:${databasePath}`;
  process.env.ADMIN_TOKEN = "test-admin-token";
  process.env.KEY_PEPPER = "test-key-pepper";
  process.env.KIRO_API_KEY = "ksk_test";
  process.env.KIRO_CLI_BIN = kiroBin;
  process.env.KIRO_WORKDIR = kiroWorkdir;
  process.env.KIRO_TIMEOUT_SECONDS = "5";
  process.env.KIRO_MAX_CONCURRENCY = "1";
  process.env.KIRO_QUEUE_MAX_PENDING = "5";
  process.env.NINEROUTER_BASE_URL = "https://nine-router.test/v1";
  process.env.NINEROUTER_API_KEY = "sk_test";
  process.env.NINEROUTER_TIMEOUT_SECONDS = "5";
  process.env.ANTHROPIC_API_KEY = "sk-ant-test";
  process.env.N8N_GATEWAY_KEY = "gw_test_n8n_seed_secret";
  process.env.CLAUDE_CODE_GATEWAY_KEY = "gw_test_claude_seed_secret";
  process.env.CURSOR_GATEWAY_KEY = "gw_test_cursor_seed_secret";
  process.env.AI_SPA_GATEWAY_KEY = "gw_test_spa_seed_secret";

  const { buildServer } = await import("../server.js");
  const app = await buildServer();
  return { app };
}

describe("internal ai gateway", () => {
  let app: Awaited<ReturnType<typeof loadTestServer>>["app"] | undefined;

  beforeEach(async () => {
    ({ app } = await loadTestServer());
  });

  afterEach(async () => {
    await app?.close();
    const { closeDb } = await import("../db/client.js");
    const { clearRateLimitBuckets } = await import("../auth/rate-limit.js");
    clearRateLimitBuckets();
    vi.unstubAllGlobals();
    closeDb();
    app = undefined;
  });

  it("returns health", async () => {
    const response = await app!.inject({
      method: "GET",
      url: "/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });

  it("returns detailed readiness", async () => {
    const response = await app!.inject({
      method: "GET",
      url: "/ready/details"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        status: "ready",
        database: expect.objectContaining({ ok: true, provider: "sqlite" }),
        limits: expect.objectContaining({ request_body_limit_bytes: 8 * 1024 * 1024 }),
        providers: expect.objectContaining({ "9router": true }),
        model_health: expect.any(Array)
      })
    );
  });

  it("records schema migration markers", async () => {
    const { getDb } = await import("../db/client.js");
    const row = getDb()
      .prepare("SELECT version FROM schema_migrations WHERE version = ?")
      .get("2026-06-20-security-reliability-v2");
    expect(row).toEqual({ version: "2026-06-20-security-reliability-v2" });
    const hardeningRow = getDb()
      .prepare("SELECT version FROM schema_migrations WHERE version = ?")
      .get("2026-06-20-production-hardening-v3");
    expect(hardeningRow).toEqual({ version: "2026-06-20-production-hardening-v3" });
  });

  it("returns public landing status without client identifiers", async () => {
    const response = await app!.inject({
      method: "GET",
      url: "/landing/status"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual(
      expect.objectContaining({
        status: "ready",
        database: "sqlite",
        provider_count: expect.any(Number),
        model_count: expect.any(Number),
        capabilities: expect.any(Array),
        models: expect.any(Array),
        usage_7d: expect.any(Array)
      })
    );
    expect(response.body).not.toContain("api_key_id");
    expect(response.body).not.toContain("client_id");
  });

  it("serves public setup guide and key checker", async () => {
    const guide = await app!.inject({ method: "GET", url: "/guide" });
    const check = await app!.inject({ method: "GET", url: "/check" });
    const guideData = await app!.inject({ method: "GET", url: "/guide/data" });
    const clientConfig = await app!.inject({ method: "GET", url: "/client-config/claude-code" });

    expect(guide.statusCode).toBe(200);
    expect(guide.body).toContain("Kết nối công cụ AI");
    expect(check.statusCode).toBe(200);
    expect(check.body).toContain("Kiểm tra API key");
    expect(guideData.statusCode).toBe(200);
    expect(guideData.json().data).toEqual(
      expect.objectContaining({ capabilities: expect.any(Array), models: expect.any(Array) })
    );
    expect(clientConfig.statusCode).toBe(200);
    expect(clientConfig.json().data).toEqual(expect.objectContaining({ defaultModel: "auto" }));
  });

  it("checks an API key without exposing its raw value", async () => {
    const response = await app!.inject({
      method: "POST",
      url: "/check/api-key",
      headers: { "x-forwarded-for": "198.51.100.42" },
      payload: { api_key: "gw_test_n8n_seed_secret" }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual(
      expect.objectContaining({
        key_name: "n8n env seed",
        client_name: "n8n",
        quota: expect.objectContaining({ rate_limit_per_minute: expect.any(Number) }),
        usage: expect.objectContaining({ request_count: expect.any(Number) })
      })
    );
    expect(response.body).not.toContain("gw_test_n8n_seed_secret");
    expect(response.body).not.toContain("key_hash");
  });

  it("returns a client error for malformed key checks", async () => {
    const response = await app!.inject({
      method: "POST",
      url: "/check/api-key",
      payload: { api_key: "short" }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: { code: "INVALID_REQUEST", message: "API key không đúng định dạng." }
    });
  });

  it("records allowlisted landing events without prompt data", async () => {
    const response = await app!.inject({
      method: "POST",
      url: "/landing/track",
      payload: {
        event: "cta_catalog",
        path: "/"
      }
    });

    expect(response.statusCode).toBe(204);
    const { getDb } = await import("../db/client.js");
    const row = getDb().prepare("SELECT event_name, path FROM landing_events LIMIT 1").get();
    expect(row).toEqual({ event_name: "cta_catalog", path: "/" });
  });

  it("rate limits public landing tracking writes by IP", async () => {
    const { getDb } = await import("../db/client.js");
    const before = getDb().prepare("SELECT COUNT(*) AS total FROM landing_events").get() as { total: number };

    for (let i = 0; i < 35; i += 1) {
      const response = await app!.inject({
        method: "POST",
        url: "/landing/track",
        headers: { "x-forwarded-for": "203.0.113.8" },
        payload: {
          event: "integration_tab",
          path: "/"
        }
      });
      expect(response.statusCode).toBe(204);
    }

    const row = getDb().prepare("SELECT COUNT(*) AS total FROM landing_events").get() as { total: number };
    expect(row.total - before.total).toBe(30);
  });

  it("lists configured gateway models", async () => {
    const response = await app!.inject({
      method: "GET",
      url: "/v1/models"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "kiro-pro", provider: "kiro-cli" }),
        expect.objectContaining({ id: "gpt-4.1-mini", provider: "openai" })
      ])
    );
  });

  it("serves API catalog and protects admin catalog", async () => {
    const catalogResponse = await app!.inject({
      method: "GET",
      url: "/v1/catalog"
    });

    expect(catalogResponse.statusCode).toBe(200);
    expect(catalogResponse.json().data).toEqual(
      expect.objectContaining({
        version: "2.0",
        endpoints: expect.arrayContaining([expect.objectContaining({ path: "/v1/chat/completions" })])
      })
    );

    const deniedAdminResponse = await app!.inject({
      method: "GET",
      url: "/admin/api/catalog"
    });
    expect(deniedAdminResponse.statusCode).toBe(401);

    const adminResponse = await app!.inject({
      method: "GET",
      url: "/admin/api/catalog",
      headers: {
        "x-admin-token": "test-admin-token"
      }
    });
    expect(adminResponse.statusCode).toBe(200);
  });

  it("exports admin-only client configuration templates", async () => {
    const deniedResponse = await app!.inject({
      method: "GET",
      url: "/admin/api/client-config/n8n"
    });
    expect(deniedResponse.statusCode).toBe(401);

    const response = await app!.inject({
      method: "GET",
      url: "/admin/api/client-config/n8n",
      headers: {
        "x-admin-token": "test-admin-token"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual(
      expect.objectContaining({
        defaultModel: "auto",
        taskType: "workflow",
        httpRequest: expect.objectContaining({
          method: "POST",
          url: expect.stringContaining("/v1/chat/completions")
        })
      })
    );
  });

  it("serves the admin dashboard", async () => {
    const response = await app!.inject({
      method: "GET",
      url: "/admin"
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.body).toContain("Admin console");
    expect(response.body).toContain("Routing Studio");
    expect(response.body).toContain("policyTaskBuilder");
    expect(response.body).toContain("overviewAlerts");
    expect(response.body).toContain("providerOpsForm");
    expect(response.body).toContain("ob-create-policy");
    expect(response.body).toContain("onboardConfigOutput");
  });

  it("onboards a user with a scoped policy and client config", async () => {
    const response = await app!.inject({
      method: "POST",
      url: "/admin/api/onboard",
      headers: {
        "x-admin-token": "test-admin-token"
      },
      payload: {
        email: "new-user@example.com",
        name: "New User",
        role: "member",
        clientName: "New User Cursor",
        clientType: "coding-tool",
        keyName: "cursor",
        keyMode: "test",
        createPolicy: true,
        allowedModels: ["auto", "strong-code"],
        allowedTaskTypes: ["coding", "review"],
        allowedProviders: ["9router"],
        allowedCostTiers: ["balanced", "strong"],
        rateLimitPerMinute: 25,
        maxInputCharacters: 45000,
        configClient: "cursor"
      }
    });

    expect(response.statusCode).toBe(200);
    const data = response.json().data;
    expect(data.user).toEqual(expect.objectContaining({ email: "new-user@example.com", role: "member" }));
    expect(data.client).toEqual(expect.objectContaining({ name: "New User Cursor", type: "coding-tool" }));
    expect(data.apiKey.raw_key).toMatch(/^gw_test_/);
    expect(data.policy).toEqual(
      expect.objectContaining({
        scope_type: "api_key",
        scope_id: data.apiKey.id,
        rate_limit_per_minute: 25,
        max_input_characters: 45000
      })
    );
    expect(data.clientConfig.openAiProvider).toEqual(
      expect.objectContaining({
        apiKey: data.apiKey.raw_key,
        model: "auto"
      })
    );
    expect(response.body).not.toContain("<gateway-api-key>");
  });

  it("returns admin control-center data", async () => {
    const deniedResponse = await app!.inject({
      method: "GET",
      url: "/admin/api/control-center"
    });
    expect(deniedResponse.statusCode).toBe(401);

    const response = await app!.inject({
      method: "GET",
      url: "/admin/api/control-center",
      headers: {
        "x-admin-token": "test-admin-token"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual(
      expect.objectContaining({
        today: expect.any(String),
        totals: expect.objectContaining({
          users: expect.any(Number),
          clients: expect.any(Number),
          active_api_keys: expect.any(Number),
          enabled_models: expect.any(Number)
        }),
        today_usage: expect.objectContaining({ requests: expect.any(Number), cost: expect.any(Number) }),
        month_usage: expect.objectContaining({ requests: expect.any(Number), cost: expect.any(Number) }),
        reliability_24h: expect.objectContaining({
          total: expect.any(Number),
          error_count: expect.any(Number),
          error_rate: expect.any(Number),
          avg_latency_ms: expect.any(Number),
          p95_latency_ms: expect.any(Number)
        }),
        alerts: expect.any(Array),
        top_clients: expect.any(Array),
        top_users: expect.any(Array)
      })
    );
  });

  it("serves the self-service user setup wizard", async () => {
    const response = await app!.inject({
      method: "GET",
      url: "/dashboard"
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("Bắt đầu");
    expect(response.body).toContain("Claude Code");
    expect(response.body).toContain("Chạy kiểm tra");
    expect(response.body).toContain("model=auto");
  });

  it("protects admin APIs with ADMIN_TOKEN", async () => {
    const response = await app!.inject({
      method: "GET",
      url: "/admin/api/users"
    });

    expect(response.statusCode).toBe(401);
  });

  it("creates an admin session from ADMIN_TOKEN", async () => {
    const loginResponse = await app!.inject({
      method: "POST",
      url: "/admin/api/login",
      payload: {
        adminToken: "test-admin-token"
      }
    });

    expect(loginResponse.statusCode).toBe(200);
    expect(loginResponse.headers["set-cookie"]).toContain("Secure");
    const session = loginResponse.json().data;
    expect(session.token).toEqual(expect.any(String));
    const { getDb } = await import("../db/client.js");
    const storedSession = getDb()
      .prepare("SELECT token FROM admin_sessions LIMIT 1")
      .get() as { token: string };
    expect(storedSession.token).not.toBe(session.token);
    expect(storedSession.token).toMatch(/^[a-f0-9]{64}$/);

    const usersResponse = await app!.inject({
      method: "GET",
      url: "/admin/api/users",
      headers: {
        "x-admin-session": session.token
      }
    });

    expect(usersResponse.statusCode).toBe(200);
  });

  it("does not count successful admin logins toward the failure limit", async () => {
    for (let i = 0; i < 7; i += 1) {
      const response = await app!.inject({
        method: "POST",
        url: "/admin/api/login",
        payload: { adminToken: "test-admin-token" }
      });
      expect(response.statusCode).toBe(200);
    }
  });

  it("rate limits repeated invalid admin login attempts", async () => {
    for (let i = 0; i < 5; i += 1) {
      const response = await app!.inject({
        method: "POST",
        url: "/admin/api/login",
        headers: { "x-forwarded-for": "203.0.113.9" },
        payload: {
          adminToken: "wrong-token"
        }
      });
      expect(response.statusCode).toBe(401);
    }

    const blocked = await app!.inject({
      method: "POST",
      url: "/admin/api/login",
      headers: { "x-forwarded-for": "203.0.113.9" },
      payload: {
        adminToken: "test-admin-token"
      }
    });

    expect(blocked.statusCode).toBe(429);
  });

  it("does not trust spoofed forwarded IP headers by default", async () => {
    for (let i = 0; i < 5; i += 1) {
      const response = await app!.inject({
        method: "POST",
        url: "/admin/api/login",
        headers: { "x-forwarded-for": `203.0.113.${i + 1}` },
        payload: { adminToken: "wrong-token" }
      });
      expect(response.statusCode).toBe(401);
    }

    const blocked = await app!.inject({
      method: "POST",
      url: "/admin/api/login",
      headers: { "x-forwarded-for": "198.51.100.99" },
      payload: { adminToken: "test-admin-token" }
    });
    expect(blocked.statusCode).toBe(429);
  });

  it("rejects webhook URLs that target private networks", async () => {
    const response = await app!.inject({
      method: "POST",
      url: "/admin/api/webhooks",
      headers: { "x-admin-token": "test-admin-token" },
      payload: {
        name: "unsafe webhook",
        url: "https://127.0.0.1/internal",
        events: ["provider.down"],
        secret: "must-not-be-returned"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("INVALID_REQUEST");
  });

  it("redacts webhook secrets from admin list responses", async () => {
    const { createWebhook } = await import("../db/repositories/webhooks.js");
    createWebhook({
      name: "test webhook",
      url: "https://hooks.example.test/events",
      events: ["admin.action"],
      secret: "webhook-secret"
    });

    const response = await app!.inject({
      method: "GET",
      url: "/admin/api/webhooks",
      headers: { "x-admin-token": "test-admin-token" }
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).not.toContain("webhook-secret");
    expect(response.json().data[0]).toEqual(expect.objectContaining({ secret_configured: true }));
  });

  it("deduplicates provider alerts during the configured cooldown", async () => {
    const { claimAlertCooldown } = await import("../db/repositories/alert-cooldowns.js");
    expect(
      claimAlertCooldown({ event: "provider.down", identity: "9router", cooldownMs: 300_000, nowMs: 1_000_000 })
    ).toBe(true);
    expect(
      claimAlertCooldown({ event: "provider.down", identity: "9router", cooldownMs: 300_000, nowMs: 1_001_000 })
    ).toBe(false);
    expect(
      claimAlertCooldown({ event: "provider.down", identity: "9router", cooldownMs: 300_000, nowMs: 1_300_001 })
    ).toBe(true);
  });

  it("creates and revokes DB-backed API keys", async () => {
    const createResponse = await app!.inject({
      method: "POST",
      url: "/admin/api/api-keys",
      headers: {
        "x-admin-token": "test-admin-token"
      },
      payload: {
        userId: "usr_n8n",
        clientId: "cli_n8n",
        name: "test generated key",
        mode: "test"
      }
    });

    expect(createResponse.statusCode).toBe(200);
    const created = createResponse.json().data;
    expect(created.raw_key).toMatch(/^gw_test_/);

    const chatResponse = await app!.inject({
      method: "POST",
      url: "/v1/chat",
      headers: {
        "x-api-key": created.raw_key
      },
      payload: {
        model: "kiro-pro",
        task_type: "review",
        messages: [{ role: "user", content: "review this" }]
      }
    });
    expect(chatResponse.statusCode).toBe(200);

    const revokeResponse = await app!.inject({
      method: "POST",
      url: `/admin/api/api-keys/${created.id}/revoke`,
      headers: {
        "x-admin-token": "test-admin-token"
      }
    });
    expect(revokeResponse.statusCode).toBe(200);

    const deniedResponse = await app!.inject({
      method: "POST",
      url: "/v1/chat",
      headers: {
        "x-api-key": created.raw_key
      },
      payload: {
        model: "kiro-pro",
        task_type: "review",
        messages: [{ role: "user", content: "review this" }]
      }
    });
    expect(deniedResponse.statusCode).toBe(401);
  });

  it("records admin audit logs for mutating admin actions", async () => {
    const createResponse = await app!.inject({
      method: "POST",
      url: "/admin/api/api-keys",
      headers: {
        "x-admin-token": "test-admin-token"
      },
      payload: {
        userId: "usr_n8n",
        clientId: "cli_n8n",
        name: "audit key",
        mode: "test"
      }
    });
    expect(createResponse.statusCode).toBe(200);

    const logsResponse = await app!.inject({
      method: "GET",
      url: "/admin/api/admin-audit-logs",
      headers: {
        "x-admin-token": "test-admin-token"
      }
    });

    expect(logsResponse.statusCode).toBe(200);
    expect(logsResponse.json().data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "api_key.created",
          target_type: "api_key"
        })
      ])
    );
  });

  it("rejects expired API keys created through admin API", async () => {
    const createResponse = await app!.inject({
      method: "POST",
      url: "/admin/api/api-keys",
      headers: {
        "x-admin-token": "test-admin-token"
      },
      payload: {
        userId: "usr_n8n",
        clientId: "cli_n8n",
        name: "expired key",
        mode: "test",
        expiresAt: "2020-01-01T00:00:00.000Z"
      }
    });

    expect(createResponse.statusCode).toBe(200);
    const created = createResponse.json().data;
    expect(created.expires_at).toBe("2020-01-01T00:00:00.000Z");

    const chatResponse = await app!.inject({
      method: "POST",
      url: "/v1/chat",
      headers: {
        "x-api-key": created.raw_key
      },
      payload: {
        model: "cheap-chat",
        task_type: "chat",
        messages: [{ role: "user", content: "hello" }]
      }
    });

    expect(chatResponse.statusCode).toBe(401);
  });

  it("denies requests disallowed by DB policy", async () => {
    const response = await app!.inject({
      method: "POST",
      url: "/v1/chat",
      headers: {
        "x-api-key": "gw_test_n8n_seed_secret"
      },
      payload: {
        model: "kiro-pro",
        task_type: "chat",
        messages: [{ role: "user", content: "chat is not allowed for kiro model route" }]
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("TASK_NOT_ALLOWED");
  });

  it("rejects missing api key", async () => {
    const response = await app!.inject({
      method: "POST",
      url: "/v1/chat",
      payload: {
        model: "kiro-pro",
        task_type: "review",
        messages: [{ role: "user", content: "review this" }]
      }
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("UNAUTHORIZED");
  });

  it("routes kiro-pro requests through the Kiro CLI adapter", async () => {
    const response = await app!.inject({
      method: "POST",
      url: "/v1/chat",
      headers: {
        "x-api-key": "gw_test_n8n_seed_secret"
      },
      payload: {
        model: "kiro-pro",
        task_type: "review",
        messages: [{ role: "user", content: "review this" }],
        metadata: { source: "test" }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["x-request-id"]).toEqual(expect.any(String));
    expect(response.json()).toEqual(
      expect.objectContaining({
        model: "kiro-pro",
        provider: "kiro-cli",
        content: "mock kiro response"
      })
    );
  });

  it("routes model=auto through the scanned model registry", async () => {
    const { upsertScannedModels } = await import("../db/repositories/model-registry.js");
    upsertScannedModels("9router", [{ id: "test/qwen-coder-plus" }]);

    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          id: "chatcmpl_test",
          choices: [{ message: { content: "mock 9router response" } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await app!.inject({
      method: "POST",
      url: "/v1/chat",
      headers: {
        "x-api-key": "gw_test_n8n_seed_secret"
      },
      payload: {
        model: "auto",
        task_type: "coding",
        messages: [{ role: "user", content: "write code" }]
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        model: "auto:coding",
        provider: "9router",
        content: "mock 9router response"
      })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://nine-router.test/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("test/qwen-coder-plus")
      })
    );
  });

  it("uses routing rules before registry priority for model=auto", async () => {
    const { upsertRoutingRule } = await import("../db/repositories/routing-rules.js");
    upsertRoutingRule({
      scopeType: "client",
      scopeId: "cli_n8n",
      capability: "chat",
      provider: "9router",
      providerModel: "rule/chat-model",
      priority: 120,
      enabled: true
    });

    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          id: "chatcmpl_rule",
          choices: [{ message: { content: "mock rule response" } }],
          usage: { prompt_tokens: 8, completion_tokens: 4 }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await app!.inject({
      method: "POST",
      url: "/v1/chat",
      headers: {
        "x-api-key": "gw_test_n8n_seed_secret"
      },
      payload: {
        model: "auto",
        task_type: "chat",
        messages: [{ role: "user", content: "hello" }]
      }
    });

    expect(response.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://nine-router.test/v1/chat/completions",
      expect.objectContaining({
        body: expect.stringContaining("rule/chat-model")
      })
    );
  });

  it("supports OpenAI-compatible chat completions", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          id: "chatcmpl_openai",
          choices: [{ message: { content: "mock compatible response" } }],
          usage: { prompt_tokens: 3, completion_tokens: 2 }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await app!.inject({
      method: "POST",
      url: "/v1/chat/completions",
      headers: {
        "x-api-key": "gw_test_n8n_seed_secret"
      },
      payload: {
        model: "cheap-chat",
        messages: [{ role: "user", content: "hello" }]
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        object: "chat.completion",
        choices: [
          expect.objectContaining({
            message: { role: "assistant", content: "mock compatible response" }
          })
        ]
      })
    );
  });

  it("enforces provider and cost-tier policy restrictions during routing", async () => {
    const keyResponse = await app!.inject({
      method: "POST",
      url: "/admin/api/api-keys",
      headers: {
        "x-admin-token": "test-admin-token"
      },
      payload: {
        userId: "usr_n8n",
        clientId: "cli_n8n",
        name: "provider restricted key",
        mode: "test"
      }
    });
    const key = keyResponse.json().data;

    const policyResponse = await app!.inject({
      method: "PUT",
      url: "/admin/api/policies",
      headers: {
        "x-admin-token": "test-admin-token"
      },
      payload: {
        scopeType: "api_key",
        scopeId: key.id,
        allowedModels: ["auto"],
        allowedTaskTypes: ["chat"],
        allowedProviders: ["openai"],
        allowedCostTiers: ["cheap"],
        rateLimitPerMinute: 10,
        maxInputCharacters: 10000,
        allowTools: false,
        logPrompts: false
      }
    });
    expect(policyResponse.statusCode).toBe(200);

    const response = await app!.inject({
      method: "POST",
      url: "/v1/chat",
      headers: {
        "x-api-key": key.raw_key
      },
      payload: {
        model: "auto",
        task_type: "chat",
        messages: [{ role: "user", content: "hello" }]
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("PROVIDER_NOT_ALLOWED");
  });

  it("routes image generation through the scanned image model registry", async () => {
    const { upsertScannedModels } = await import("../db/repositories/model-registry.js");
    upsertScannedModels("9router", [{ id: "test/flux-image-pro" }]);

    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          created: 123,
          data: [{ url: "https://images.test/generated.png", revised_prompt: "spa room" }]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await app!.inject({
      method: "POST",
      url: "/v1/images/generations",
      headers: {
        "x-api-key": "gw_test_n8n_seed_secret"
      },
      payload: {
        model: "auto",
        task_type: "image-generation",
        prompt: "spa room interior"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        model: "auto:image-generation",
        provider: "9router",
        data: [{ url: "https://images.test/generated.png", revised_prompt: "spa room" }]
      })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://nine-router.test/v1/images/generations",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("test/flux-image-pro")
      })
    );
    const { getUsageSummary } = await import("../db/repositories/usage.js");
    expect(getUsageSummary({ days: 1, groupBy: "model" })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bucket: "auto:image-generation",
          estimated_cost: expect.any(Number)
        })
      ])
    );
  });

  it("forwards staff reference images to the image provider", async () => {
    const { upsertScannedModels } = await import("../db/repositories/model-registry.js");
    upsertScannedModels("9router", [{ id: "test/reference-image-model", kind: "image" }]);
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body ?? "{}"));
      expect(payload.task_type).toBe("image-edit");
      expect(payload.reference_mode).toBe("identity");
      expect(payload.reference_images).toEqual([
        expect.objectContaining({ image_base64: "aGVsbG8=", weight: 1 })
      ]);
      return new Response(JSON.stringify({ data: [{ url: "https://images.test/staff.png" }] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await app!.inject({
      method: "POST",
      url: "/v1/images/generations",
      headers: { "x-api-key": "gw_test_n8n_seed_secret" },
      payload: {
        model: "auto",
        task_type: "image-generation",
        prompt: "Vietnamese spa therapist",
        reference_mode: "identity",
        reference_strength: 0.85,
        reference_images: [{ image_base64: "aGVsbG8=", weight: 1 }]
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data[0].url).toBe("https://images.test/staff.png");
  });

  it("reports image reference capabilities for authenticated clients", async () => {
    const response = await app!.inject({
      method: "GET",
      url: "/v1/images/capabilities",
      headers: { "x-api-key": "gw_test_n8n_seed_secret" }
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual(expect.objectContaining({
      reference_images: true,
      max_reference_images: 4,
      vision_quality_check: true
    }));
  });

  it("routes embeddings through the scanned embedding model registry", async () => {
    const { upsertScannedModels } = await import("../db/repositories/model-registry.js");
    upsertScannedModels("9router", [{ id: "test/embed-small", kind: "embedding" }]);

    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          object: "list",
          data: [{ object: "embedding", embedding: [0.1, 0.2], index: 0 }],
          usage: { prompt_tokens: 2, total_tokens: 2 }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await app!.inject({
      method: "POST",
      url: "/v1/embeddings",
      headers: {
        "x-api-key": "gw_test_n8n_seed_secret"
      },
      payload: {
        model: "auto",
        input: "spa appointment"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        object: "list",
        model: "auto:embedding",
        data: [{ object: "embedding", embedding: [0.1, 0.2], index: 0 }]
      })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://nine-router.test/v1/embeddings",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("test/embed-small")
      })
    );
  });

  it("routes text-to-speech through the scanned audio model registry", async () => {
    const { upsertScannedModels } = await import("../db/repositories/model-registry.js");
    upsertScannedModels("9router", [{ id: "test/tts-voice", kind: "tts" }]);

    const fetchMock = vi.fn(async () => new Response("audio-bytes", { status: 200, headers: { "content-type": "audio/mpeg" } }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await app!.inject({
      method: "POST",
      url: "/v1/audio/speech",
      headers: {
        "x-api-key": "gw_test_n8n_seed_secret"
      },
      payload: {
        model: "auto",
        input: "Welcome to An Nhu Spa",
        voice: "alloy"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("audio/mpeg");
    expect(response.body).toBe("audio-bytes");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://nine-router.test/v1/audio/speech",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("test/tts-voice")
      })
    );
  });

  it("rejects oversized media base64 payloads before provider routing", async () => {
    const response = await app!.inject({
      method: "POST",
      url: "/v1/audio/transcriptions",
      headers: {
        "x-api-key": "gw_test_n8n_seed_secret"
      },
      payload: {
        model: "auto",
        audio_base64: Buffer.alloc(16).toString("base64")
      }
    });

    expect(response.statusCode).toBe(413);
    expect(response.json().error.code).toBe("INVALID_REQUEST");
  });

  it("updates model health and returns provider health summary", async () => {
    const { upsertScannedModels } = await import("../db/repositories/model-registry.js");
    const [model] = upsertScannedModels("9router", [{ id: "test/health-chat" }]);

    const updateResponse = await app!.inject({
      method: "PATCH",
      url: `/admin/api/model-registry/${encodeURIComponent(model.id)}/health`,
      headers: {
        "x-admin-token": "test-admin-token"
      },
      payload: {
        healthStatus: "healthy",
        avgLatencyMs: 321,
        errorCount: 0
      }
    });

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json().data).toEqual(
      expect.objectContaining({
        id: model.id,
        health_status: "healthy",
        avg_latency_ms: 321
      })
    );

    const summaryResponse = await app!.inject({
      method: "GET",
      url: "/admin/api/provider-health",
      headers: {
        "x-admin-token": "test-admin-token"
      }
    });

    expect(summaryResponse.statusCode).toBe(200);
    expect(summaryResponse.json().data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: "9router",
          healthy: 1
        })
      ])
    );
  });

  it("returns usage summary grouped by client", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          id: "chatcmpl_usage",
          choices: [{ message: { content: "usage response" } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const chatResponse = await app!.inject({
      method: "POST",
      url: "/v1/chat",
      headers: {
        "x-api-key": "gw_test_n8n_seed_secret"
      },
      payload: {
        model: "cheap-chat",
        task_type: "chat",
        messages: [{ role: "user", content: "hello" }]
      }
    });
    expect(chatResponse.statusCode).toBe(200);

    const summaryResponse = await app!.inject({
      method: "GET",
      url: "/admin/api/usage/summary?groupBy=client&days=1",
      headers: {
        "x-admin-token": "test-admin-token"
      }
    });

    expect(summaryResponse.statusCode).toBe(200);
    expect(summaryResponse.json().data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bucket: "cli_n8n",
          request_count: 1,
          input_tokens: 10,
          output_tokens: 5
        })
      ])
    );
  });

  it("returns per-api-key usage totals", async () => {
    const keyResponse = await app!.inject({
      method: "POST",
      url: "/admin/api/api-keys",
      headers: {
        "x-admin-token": "test-admin-token"
      },
      payload: {
        userId: "usr_n8n",
        clientId: "cli_n8n",
        name: "usage key",
        mode: "test"
      }
    });
    const key = keyResponse.json().data;

    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          id: "chatcmpl_key_usage",
          choices: [{ message: { content: "key usage response" } }],
          usage: { prompt_tokens: 4, completion_tokens: 6 }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const chatResponse = await app!.inject({
      method: "POST",
      url: "/v1/chat",
      headers: {
        "x-api-key": key.raw_key
      },
      payload: {
        model: "cheap-chat",
        task_type: "chat",
        messages: [{ role: "user", content: "hello" }]
      }
    });
    expect(chatResponse.statusCode).toBe(200);

    const usageResponse = await app!.inject({
      method: "GET",
      url: `/admin/api/api-keys/${key.id}/usage?days=1`,
      headers: {
        "x-admin-token": "test-admin-token"
      }
    });

    expect(usageResponse.statusCode).toBe(200);
    expect(usageResponse.json().data).toEqual(
      expect.objectContaining({
        api_key_id: key.id,
        totals: expect.objectContaining({
          request_count: 1,
          input_tokens: 4,
          output_tokens: 6
        })
      })
    );
  });

  it("dry-runs routing for an API key without calling providers", async () => {
    const keyResponse = await app!.inject({
      method: "POST",
      url: "/admin/api/api-keys",
      headers: {
        "x-admin-token": "test-admin-token"
      },
      payload: {
        userId: "usr_n8n",
        clientId: "cli_n8n",
        name: "dry run key",
        mode: "test"
      }
    });
    const key = keyResponse.json().data;

    await app!.inject({
      method: "PUT",
      url: "/admin/api/routing-rules",
      headers: {
        "x-admin-token": "test-admin-token"
      },
      payload: {
        scopeType: "client",
        scopeId: "cli_n8n",
        capability: "chat",
        provider: "9router",
        providerModel: "dry-run/chat",
        priority: 100,
        enabled: true
      }
    });

    const response = await app!.inject({
      method: "POST",
      url: "/admin/api/routing/dry-run",
      headers: {
        "x-admin-token": "test-admin-token"
      },
      payload: {
        apiKeyId: key.id,
        model: "auto",
        taskType: "chat"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual(
      expect.objectContaining({
        api_key_id: key.id,
        client_id: "cli_n8n",
        policy: expect.objectContaining({
          allowed_models: expect.any(Array),
          allowed_task_types: expect.any(Array)
        }),
        decision: expect.objectContaining({
          source: "routing_rule",
          routing_rule: expect.objectContaining({ provider_model: "dry-run/chat" })
        }),
        resolved_model: "auto:chat",
        provider_model: "dry-run/chat"
      })
    );
  });

  it("applies provider operations to model registry rows", async () => {
    const { upsertScannedModels } = await import("../db/repositories/model-registry.js");
    upsertScannedModels("9router", [{ id: "ops/test-a" }, { id: "ops/test-b" }]);

    const deniedResponse = await app!.inject({
      method: "PATCH",
      url: "/admin/api/provider-ops",
      payload: {
        provider: "9router",
        enabled: false,
        reason: "maintenance"
      }
    });
    expect(deniedResponse.statusCode).toBe(401);

    const response = await app!.inject({
      method: "PATCH",
      url: "/admin/api/provider-ops",
      headers: {
        "x-admin-token": "test-admin-token"
      },
      payload: {
        provider: "9router",
        enabled: false,
        priority: 12,
        reason: "maintenance"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual(
      expect.objectContaining({
        updated: expect.any(Number),
        models: expect.arrayContaining([
          expect.objectContaining({ provider: "9router", enabled: false, priority: 12 })
        ])
      })
    );
  });

  it("enforces per-key rate limits from policy", async () => {
    const keyResponse = await app!.inject({
      method: "POST",
      url: "/admin/api/api-keys",
      headers: {
        "x-admin-token": "test-admin-token"
      },
      payload: {
        userId: "usr_n8n",
        clientId: "cli_n8n",
        name: "rate limited key",
        mode: "test"
      }
    });

    const key = keyResponse.json().data;

    const policyResponse = await app!.inject({
      method: "PUT",
      url: "/admin/api/policies",
      headers: {
        "x-admin-token": "test-admin-token"
      },
      payload: {
        scopeType: "api_key",
        scopeId: key.id,
        allowedModels: ["kiro-pro"],
        allowedTaskTypes: ["review"],
        rateLimitPerMinute: 1,
        maxInputCharacters: 10000,
        allowTools: false,
        logPrompts: false
      }
    });
    expect(policyResponse.statusCode).toBe(200);

    const payload = {
      model: "kiro-pro",
      task_type: "review",
      messages: [{ role: "user", content: "review this" }]
    };

    const first = await app!.inject({ method: "POST", url: "/v1/chat", headers: { "x-api-key": key.raw_key }, payload });
    const second = await app!.inject({ method: "POST", url: "/v1/chat", headers: { "x-api-key": key.raw_key }, payload });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(429);
    expect(second.json().error.code).toBe("RATE_LIMITED");
  });

  it("creates a SQLite backup through admin API", async () => {
    const response = await app!.inject({
      method: "POST",
      url: "/admin/api/database/backup",
      headers: {
        "x-admin-token": "test-admin-token"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.path).toContain("backups");
    expect(response.json().data.bytes).toBeGreaterThan(0);
  });

  it("streams chat response via SSE", async () => {
    const sseBody = [
      'data: {"type":"message_start","message":{"usage":{"input_tokens":10,"output_tokens":0}}}',
      'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" world"}}',
      'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":2}}',
      'data: {"type":"message_stop"}',
      ""
    ].join("\n");
    const fetchMock = vi.fn(async () =>
      new Response(sseBody, {
        status: 200,
        headers: { "content-type": "text/event-stream" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    process.env.ANTHROPIC_API_KEY = "sk-ant-test";

    const response = await app!.inject({
      method: "POST",
      url: "/v1/chat",
      headers: { "x-api-key": "gw_test_claude_seed_secret" },
      payload: {
        model: "claude-sonnet",
        task_type: "chat",
        messages: [{ role: "user", content: "hello" }],
        stream: true
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/event-stream");
    expect(response.body).toContain("data:");
    expect(response.body).toContain("[DONE]");
    expect(response.body).toContain("Hello");
    expect(response.body).toContain("world");
  });

  it("paginates and filters audit logs", async () => {
    const response = await app!.inject({
      method: "GET",
      url: "/admin/api/audit-logs?page=1&limit=10",
      headers: { "x-admin-token": "test-admin-token" }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toMatchObject({
      data: expect.any(Array),
      total: expect.any(Number),
      page: 1,
      limit: 10,
      pages: expect.any(Number)
    });
  });

  it("filters audit logs by status", async () => {
    const response = await app!.inject({
      method: "GET",
      url: "/admin/api/audit-logs?status=error&limit=5",
      headers: { "x-admin-token": "test-admin-token" }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.every((r: { status: string }) => r.status === "error")).toBe(true);
  });

  it("allows users to create their own API keys via dashboard", async () => {
    const createResponse = await app!.inject({
      method: "POST",
      url: "/dashboard/api/my/keys",
      headers: { "x-api-key": "gw_test_n8n_seed_secret" },
      payload: { name: "my-new-key" }
    });

    expect(createResponse.statusCode).toBe(200);
    const result = createResponse.json().data;
    expect(result.raw_key).toMatch(/^gw_live_/);
    expect(result.name).toBe("my-new-key");

    const chatResponse = await app!.inject({
      method: "POST",
      url: "/v1/chat",
      headers: { "x-api-key": result.raw_key },
      payload: {
        model: "kiro-pro",
        task_type: "review",
        messages: [{ role: "user", content: "test" }]
      }
    });
    expect(chatResponse.statusCode).toBe(200);
  });

  it("diagnoses self-service tool setup for the authenticated user", async () => {
    const claudeResponse = await app!.inject({
      method: "GET",
      url: "/dashboard/api/my/diagnostics/claude-code?mode=quality",
      headers: { "x-api-key": "gw_test_n8n_seed_secret" }
    });
    expect(claudeResponse.statusCode).toBe(200);
    expect(claudeResponse.json().data).toEqual(
      expect.objectContaining({
        tool: "claude-code",
        ready: true,
        route: expect.objectContaining({
          model: "strong-code",
          task_type: "coding",
          provider: "9router"
        })
      })
    );

    const spaResponse = await app!.inject({
      method: "GET",
      url: "/dashboard/api/my/diagnostics/ai-spa",
      headers: { "x-api-key": "gw_test_n8n_seed_secret" }
    });
    expect(spaResponse.statusCode).toBe(200);
    expect(spaResponse.json().data).toEqual(
      expect.objectContaining({
        tool: "ai-spa",
        ready: true,
        route: expect.objectContaining({
          model: "auto",
          task_type: "spa-chat",
          provider: "9router"
        })
      })
    );
  });

  it("returns analytics overview for admin", async () => {
    const response = await app!.inject({
      method: "GET",
      url: "/admin/api/analytics/overview?days=7",
      headers: { "x-admin-token": "test-admin-token" }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toMatchObject({
      by_date: expect.any(Array),
      by_provider: expect.any(Array),
      by_model: expect.any(Array)
    });
  });

  it("returns provider health stats from audit data", async () => {
    const response = await app!.inject({
      method: "GET",
      url: "/admin/api/provider-health/recent",
      headers: { "x-admin-token": "test-admin-token" }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual(expect.any(Array));
  });

  it("exports a migration-ready database manifest", async () => {
    const response = await app!.inject({
      method: "GET",
      url: "/admin/api/database/export",
      headers: {
        "x-admin-token": "test-admin-token"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual(
      expect.objectContaining({
        manifest: expect.objectContaining({
          version: 2,
          includes_secrets: false,
          api_keys_include_raw_key: false
        }),
        routing_rules: expect.any(Array),
        model_registry: expect.any(Array),
        provider_health: expect.any(Array)
      })
    );
  });
});
