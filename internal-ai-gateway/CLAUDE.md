# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # tsx watch — hot reload, port 8787
npm run build    # tsc compile to dist/
npm run lint     # tsc --noEmit type check only
npm test         # vitest run (all tests)
npx vitest run --reporter=verbose   # single test run with names
```

Run a single test file:
```bash
npx vitest run src/tests/gateway.test.ts
```

Deploy to VPS (rsync + docker compose build + up):
```bash
rsync -av -e "ssh -i ~/.ssh/google_ai_annhuspa -o StrictHostKeyChecking=no" src/ quyetluu05@35.240.135.21:/opt/internal-ai-gateway/src/
ssh -i ~/.ssh/google_ai_annhuspa quyetluu05@35.240.135.21 "cd /opt/internal-ai-gateway && docker compose -f docker-compose.prod.yml build --no-cache gateway && docker compose -f docker-compose.prod.yml up -d --no-deps gateway"
```

## Architecture

### Request flow

```
Client --x-api-key--> Fastify route
  --> apiKeyAuth (preHandler)     # hashes key, resolves policy, sets request.apiKeyContext
  --> assertXxx() policy checks   # model, task, quota, rate limit
  --> resolveSmartModelRoute()    # picks provider+model: named alias → routing_rules → model_registry → hardcoded fallback
  --> adapter.chat() / chatStream()
  --> writeAuditLog() + incrementUsage()
```

### Database

Single SQLite file (`data/gateway.db`) via Node's built-in `node:sqlite` (`DatabaseSync` — synchronous API). Schema migrations run on startup in `src/db/client.ts`. No ORM.

Table summary:
- `users`, `clients`, `api_keys` — identity
- `policies` — JSON arrays for `allowed_models`/`allowed_task_types`, scoped by `global | user | client | api_key`; most-specific scope wins
- `audit_logs` — one row per request
- `usage_daily` — aggregated per (date, api_key_id, client_id, provider, model)
- `model_registry` — 9router-scanned models with priority/enabled flags; drives `model=auto` selection
- `routing_rules` — explicit override: capability → provider+model, wins over model_registry
- `rate_limit_counters` — in-memory minute buckets (`src/auth/rate-limit.ts`), not persisted
- `webhooks` — CRUD for outbound webhooks with HMAC signing

### Provider adapters (`src/providers/`)

Each adapter implements `AiProviderAdapter` (in `types.ts`). Streaming adapters additionally implement `StreamingAiProviderAdapter` with `chatStream()` returning `AsyncIterable<StreamChunk>`.

| Alias | Provider | Notes |
|-------|----------|-------|
| `claude-sonnet` | `anthropic` | Direct Anthropic API |
| `gpt-4.1-mini` | `openai` | OpenAI-compatible |
| `kiro-pro` | `kiro-cli` | Spawns `kiro-cli` subprocess via `execa`, bounded queue |
| `cheap-chat`, `strong-code`, `spa-assistant` | `9router` | Tier-2 router, OpenAI-compatible |
| `auto` | resolved at runtime | routing_rules → model_registry → hardcoded fallback |

### API key hashing

`src/db/api-keys.ts` — scrypt + `KEY_PEPPER`. Keys are shown **once** on creation. Changing `KEY_PEPPER` invalidates all existing keys. Both `x-api-key` and `Authorization: Bearer` headers accepted.

### Frontend (no build step)

All dashboards are served as TypeScript template literal strings:

- `src/admin/` — admin-only dashboard (requires `x-admin-token`)
- `src/dashboard/` — user-facing dashboard (requires API key)
- `src/landing/` — public marketing page
- `src/public/` — public self-service tools

**Critical**: these strings use backticks as the outer delimiter. Any JS template literal inside must escape backticks as `` \` `` and template expressions as `\${...}`. CSS custom properties (`var(--x)`) are fine since `$` alone is not a template delimiter. Asset URLs must include a version query param (e.g. `app.js?v=N`) to bust browser cache after deploys; routes serve `Cache-Control: no-store`.

### Policy enforcement order

`resolvePolicyForContext()` in `src/db/repositories/policies.ts` returns the single most-specific matching policy: `api_key > client > user > global`. Enforcement helpers in `src/auth/policies.ts`: `assertModelAllowed`, `assertTaskAllowed`, `assertInputSizeAllowed`, `assertQuotaAllowed`. Per-key rate limiting uses an in-memory counter map reset on each minute boundary.

### User onboarding

Creating a key for a new user currently requires 4 separate admin steps: create User → create Client (referencing user ID) → optionally create Policy → create API Key (referencing both IDs). The planned simplification is a single `POST /admin/api/onboard` endpoint + wizard UI that does all three in one transaction.

### Seed keys

Four env vars (`CLAUDE_CODE_GATEWAY_KEY`, `CURSOR_GATEWAY_KEY`, `N8N_GATEWAY_KEY`, `AI_SPA_GATEWAY_KEY`) are imported as live API keys on startup via `src/db/seed.ts`. Seed runs are idempotent. These keys bypass the "shown once" rule because they come from `.env`.

### Testing

`src/tests/gateway.test.ts` uses `app.inject()` (Fastify's in-process HTTP). Each `beforeEach` calls `vi.resetModules()` + fresh temp SQLite file to ensure isolation. The test sets all provider env vars including a mock `kiro-cli` binary. 34 tests total. No mocks of the database layer.
