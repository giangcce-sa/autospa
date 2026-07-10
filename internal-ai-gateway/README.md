# Internal AI Gateway

Standalone internal API gateway for Claude Code, Cursor, n8n, AI Spa, Anthropic-compatible, OpenAI-compatible, and Kiro Pro via Kiro CLI headless mode.

## Quick Start

```bash
cp .env.example .env
npm install
npm run dev
```

## VPS Deploy

Production deployment files:

- `docker-compose.prod.yml`
- `Caddyfile`
- `.env.vps.example`
- `scripts/deploy-vps.sh`
- `DEPLOY.md`

Read [DEPLOY.md](/Users/luuquyet/Desktop/autospa/internal-ai-gateway/DEPLOY.md) for the VPS procedure.

Health checks:

```bash
curl http://localhost:8787/health
curl http://localhost:8787/ready
```

Admin dashboard:

```text
http://localhost:8787/admin
```

The dashboard shows gateway health, provider readiness, model routing, and a controlled `/v1/chat` request console. Paste one of the internal gateway client keys from `.env` into the console before sending a test request.

The dashboard also manages users, clients, API keys, policies, audit logs, and usage. Admin API calls require `ADMIN_TOKEN`; paste that value into the dashboard token field.

Local database defaults to SQLite:

```env
DATABASE_PROVIDER=sqlite
DATABASE_URL=file:./data/gateway.db
TRUST_PROXY=false
PROVIDER_ALERT_COOLDOWN_SECONDS=300
MAX_MEDIA_BASE64_BYTES=6291456
ADMIN_TOKEN=change-me-admin
ADMIN_SESSION_TTL_SECONDS=28800
KEY_PEPPER=change-this-key-pepper-before-production
```

Postgres/Neon is intentionally blocked until a real Postgres adapter and migrations are added. Keep `DATABASE_PROVIDER=sqlite` for the current local and VPS build.

Set `TRUST_PROXY=true` only when the gateway is behind the included Caddy reverse proxy. Direct deployments must leave it `false` so clients cannot spoof forwarded IP headers. Provider-down webhooks are deduplicated per provider using `PROVIDER_ALERT_COOLDOWN_SECONDS`.

Change `KEY_PEPPER` before production. Existing API keys are tied to the pepper used when their hashes were created, so changing it invalidates old keys unless you recreate them.

Seeded env keys are imported into the database on startup. New keys created in the dashboard use this format and are only shown once:

```text
gw_live_<prefix>_<secret>
gw_test_<prefix>_<secret>
```

Admin session:

```bash
curl -X POST http://localhost:8787/admin/api/login \
  -H "content-type: application/json" \
  -d '{"adminToken":"change-me-admin"}'
```

Backup local SQLite:

```bash
curl -X POST http://localhost:8787/admin/api/database/backup \
  -H "x-admin-token: change-me-admin"
```

Export management data:

```bash
curl http://localhost:8787/admin/api/database/export \
  -H "x-admin-token: change-me-admin"
```

Chat request:

```bash
curl -X POST http://localhost:8787/v1/chat \
  -H "content-type: application/json" \
  -H "x-api-key: gw_test_n8n_dev_change_me" \
  -d '{
    "model": "kiro-pro",
    "task_type": "review",
    "messages": [{"role": "user", "content": "Review this design at a high level."}],
    "metadata": {"source": "n8n"}
  }'
```

## Kiro Provider

Install Kiro CLI and configure `KIRO_API_KEY` before using `model=kiro-pro`.

```bash
kiro-cli whoami
KIRO_API_KEY=ksk_xxxxx kiro-cli chat --no-interactive "hello"
```

The gateway never exposes `KIRO_API_KEY` to callers. It runs Kiro through a bounded queue with provider-specific timeout and concurrency limits.

## 9router Provider

Configure 9router when the VPS router is ready:

```env
NINEROUTER_BASE_URL=http://nine-router:20128/v1
NINEROUTER_API_KEY=
NINEROUTER_TIMEOUT_SECONDS=90
NINEROUTER_INITIAL_PASSWORD=change-me-nine-router
NINEROUTER_JWT_SECRET=change-this-nine-router-jwt-secret
NINEROUTER_API_KEY_SECRET=change-this-nine-router-api-key-secret
NINEROUTER_MACHINE_ID_SALT=change-this-nine-router-machine-id-salt
NINEROUTER_REQUIRE_API_KEY=true
NINEROUTER_AUTH_COOKIE_SECURE=false
```

Gateway aliases routed to 9router:

- `cheap-chat` -> `alicode/glm-5`
- `strong-code` -> `alicode/qwen3-coder-plus`
- `spa-assistant` -> `alicode/qwen3.5-plus`

The gateway also supports smart routing with `model=auto`. Admins can scan 9router models from the dashboard Model Registry panel, enable/disable models, set priority, and assign task types. When a client sends `model=auto`, the gateway selects the highest-priority enabled registry model for the request `task_type`.

Supported capabilities:

- `chat`, `spa-chat`, `workflow`
- `coding`, `review`, `test-generation`, `repo-analysis`
- `image-generation`, `image-edit`, `vision`
- `embedding`, `rerank`
- `speech-to-text`, `text-to-speech`

Text requests use `/v1/chat`. Image generation uses `/v1/images/generations`:

```bash
curl -X POST http://localhost:8787/v1/images/generations \
  -H "x-api-key: gw_live_xxx" \
  -H "content-type: application/json" \
  -d '{"model":"auto","task_type":"image-generation","prompt":"warm spa room interior"}'
```

Tier 1 gateway keeps auth, policy, audit, and usage. Tier 2 9router handles provider fallback and format translation.

Test 9router health from the gateway:

```bash
curl -X POST http://localhost:8787/admin/api/providers/9router/test \
  -H "x-admin-token: change-me-admin"
```

The production compose runs `decolua/9router:latest` internally. Its dashboard/API is bound to VPS localhost only:

```bash
ssh -i ~/.ssh/google_ai_annhuspa -L 20128:127.0.0.1:20128 quyetluu05@35.240.135.21
```

Then open:

```text
http://127.0.0.1:20128/dashboard
```

Create a 9router API key in that dashboard and set it as `NINEROUTER_API_KEY` in the gateway `.env`. Until this key is configured, the gateway can verify that 9router is reachable, but 9router model calls will be rejected by 9router.

```text
http://127.0.0.1:20128/dashboard
```
