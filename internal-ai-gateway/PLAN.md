# Internal AI API Gateway Plan

## 1. Mục tiêu

Xây dựng một API Gateway nội bộ làm lớp trung gian thống nhất cho:

- Claude Code
- Cursor
- n8n workflows
- Hệ thống AI Spa
- Các AI provider hiện tại hoặc tương lai
- Kiro Pro qua Kiro CLI headless mode

Gateway chịu trách nhiệm gom chuẩn API, kiểm soát truy cập, routing request, theo dõi chi phí, logging, rate limit, audit, và chuẩn hóa response để các client nội bộ không phụ thuộc trực tiếp vào từng provider.

Mục tiêu dài hạn là biến gateway thành control center nội bộ cho AI:

- Multi-user và service account.
- Tạo, revoke, rotate API key.
- Policy theo user, client hoặc API key.
- Usage/cost tracking theo ngày.
- Admin dashboard để quản lý user/key/policy/audit.
- Tier-2 routing qua 9router trên VPS.
- Local-first database khi dev, online database khi deploy.

## 2. Nguyên tắc thiết kế

- Internal-first: ưu tiên bảo mật mạng nội bộ, API key nội bộ, audit rõ ràng.
- Provider-agnostic: không khóa chặt vào một AI provider.
- Tool-friendly: Claude Code, Cursor và n8n có thể gọi dễ qua HTTP API.
- Observable by default: mọi request quan trọng phải có trace id, log, latency, token usage và cost estimate.
- Fail safely: lỗi provider, timeout, quota hoặc malformed response phải được chuẩn hóa.
- Incremental delivery: làm bản MVP chạy được trước, sau đó bổ sung policy, dashboard và automation.
- Local-first, production-ready: phát triển bằng SQLite local, nhưng schema/repository phải chuẩn bị sẵn đường nâng lên Postgres online.
- Separation of responsibility: Tier 1 lo auth/policy/audit/user management; Tier 2 9router lo fallback/format translation/provider routing.

## 3. Phạm vi MVP

MVP hiện tại đã/đang có các năng lực sau:

- REST API nội bộ cho chat/completion.
- API key auth cho từng client: `claude-code`, `cursor`, `n8n`, `ai-spa`.
- Provider adapter tối thiểu cho OpenAI-compatible endpoint, Anthropic-compatible endpoint và Kiro CLI headless.
- Request routing theo `model`, `provider`, hoặc `task_type`.
- Rate limit theo client.
- Request/response logging có che thông tin nhạy cảm.
- Health check và readiness check.
- Docker Compose để chạy local/internal server.
- Tài liệu API contract.
- Admin dashboard cơ bản tại `/admin`.

V2 cần mở rộng thêm:

- SQLite local database.
- Multi-user.
- API key management.
- Policy management.
- Audit log lưu DB.
- Usage summary từ DB.
- 9router adapter như Tier-2 provider.
- Admin dashboard CRUD user/key/policy/audit.

Không đưa vào giai đoạn gần:

- Multi-tenant billing phức tạp.
- Fine-tuning management.
- Vector database nếu chưa có use case rõ.
- Public internet exposure.

## 4. Kiến trúc đề xuất

### 4.1 Kiến trúc hiện tại

```mermaid
flowchart LR
    A["Claude Code"] --> G["Internal AI API Gateway"]
    B["Cursor"] --> G
    C["n8n"] --> G
    D["AI Spa"] --> G

    G --> Auth["Auth & Client Policy"]
    G --> Router["Model Router"]
    G --> Logs["Audit Logs"]
    G --> Metrics["Metrics"]

    Router --> P1["Anthropic Adapter"]
    Router --> P2["OpenAI-compatible Adapter"]
    Router --> P3["Kiro CLI Adapter"]
    Router --> P4["Local / Future Provider Adapter"]
```

### 4.2 Kiến trúc mục tiêu với 9router

```mermaid
flowchart TB
    U["Users / Service Accounts"] --> K["Gateway API Keys"]
    K --> T1["Tier 1: Internal AI Gateway"]

    T1 --> Auth["Auth + User + API Key Management"]
    T1 --> Policy["Policy + Quota"]
    T1 --> Audit["Audit + Usage DB"]
    T1 --> Spa["AI Spa / n8n / Cursor / Claude Code Integrations"]

    T1 --> DirectKiro["Optional Direct Kiro CLI Adapter"]
    T1 --> T2["Tier 2: 9router on VPS"]

    T2 --> Fallback["Fallback + Format Translation"]
    Fallback --> GLM["GLM Cheap"]
    Fallback --> Anthropic["Anthropic Paid"]
    Fallback --> OpenAI["OpenAI-compatible"]
    Fallback --> Kiro["Kiro if supported legally/stably"]
```

Quy tắc phân chia trách nhiệm:

- Tier 1 Gateway quyết định ai được gọi, gọi model/task nào, giới hạn bao nhiêu, log gì.
- Tier 2 9router quyết định provider thật, fallback provider, retry provider và format translation.
- Không để cả Tier 1 và Tier 2 cùng fallback phức tạp cho cùng một request, trừ khi có rule rõ trong policy.

### 4.3 Database strategy

```text
Development:
Gateway -> SQLite local file

Production/VPS:
Gateway -> Online Postgres, ví dụ Supabase hoặc Neon
```

Env mục tiêu:

```env
DATABASE_PROVIDER=sqlite
DATABASE_URL=file:./data/gateway.db
```

Khi deploy:

```env
DATABASE_PROVIDER=postgres
DATABASE_URL=postgresql://...
```

Repository/ORM phải che khác biệt SQLite/Postgres để route/auth/dashboard không phụ thuộc trực tiếp vào database engine.

## 5. Thành phần chính

### 5.1 API Layer

Đề xuất dùng Node.js với Fastify hoặc NestJS.

Fastify phù hợp nếu muốn gọn, nhanh, ít ceremony. NestJS phù hợp nếu dự án sẽ lớn, nhiều module, nhiều team cùng mở rộng.

Endpoint MVP:

```http
GET /health
GET /ready
POST /v1/chat
POST /v1/completions
POST /v1/tools/run
GET /v1/models
GET /v1/usage/summary
```

Endpoint admin V2:

```http
GET  /admin
GET  /admin/api/users
POST /admin/api/users
PATCH /admin/api/users/:id

GET  /admin/api/api-keys
POST /admin/api/api-keys
POST /admin/api/api-keys/:id/revoke
POST /admin/api/api-keys/:id/rotate

GET  /admin/api/policies
PUT  /admin/api/policies/:id

GET  /admin/api/audit-logs
GET  /admin/api/usage/daily
```

### 5.2 Auth & Client Policy

Hiện tại mỗi client có một API key nội bộ từ env:

- `CLAUDE_CODE_GATEWAY_KEY`
- `CURSOR_GATEWAY_KEY`
- `N8N_GATEWAY_KEY`
- `AI_SPA_GATEWAY_KEY`

V2 sẽ thay bằng API key trong DB. Env key chỉ giữ để seed lần đầu hoặc dev fallback.

API key format:

```text
gw_live_<prefix>_<secret>
gw_test_<prefix>_<secret>
```

Lưu ý bảo mật:

- Chỉ hiển thị raw API key một lần khi tạo.
- DB chỉ lưu `key_hash` và `key_prefix`.
- Hash bằng HMAC-SHA-256 hoặc SHA-256 có server-side pepper.
- Admin có thể revoke/rotate key.
- Request client dùng `Authorization: Bearer <api_key>` hoặc `x-api-key`.

Auth flow V2:

```mermaid
sequenceDiagram
    participant Client
    participant Gateway
    participant DB
    participant Provider

    Client->>Gateway: POST /v1/chat Authorization: Bearer gw_live_...
    Gateway->>DB: lookup api key by prefix/hash
    DB-->>Gateway: user + client + policy
    Gateway->>Gateway: quota/rate/policy check
    Gateway->>Provider: call 9router/direct provider
    Provider-->>Gateway: normalized response
    Gateway->>DB: write audit + usage
    Gateway-->>Client: response
```

Policy theo client:

```json
{
  "client_id": "n8n",
  "allowed_models": ["claude-sonnet", "gpt-4.1-mini"],
  "rate_limit_per_minute": 60,
  "max_input_tokens": 20000,
  "allow_tools": true,
  "log_prompts": false
}
```

Policy V2 có thể áp dụng theo scope:

```json
{
  "scope_type": "api_key",
  "scope_id": "key_...",
  "allowed_models": ["cheap-chat", "strong-code", "kiro-pro"],
  "allowed_task_types": ["chat", "review", "coding"],
  "rate_limit_per_minute": 60,
  "daily_request_limit": 5000,
  "monthly_token_limit": 5000000,
  "allow_tools": true,
  "log_prompts": false
}
```

Priority khi resolve policy:

1. API key policy.
2. Client policy.
3. User policy.
4. Default global policy.

### 5.3 Model Router

Gateway nhận request thống nhất:

```json
{
  "model": "claude-sonnet",
  "task_type": "coding",
  "messages": [
    {
      "role": "user",
      "content": "Analyze this issue"
    }
  ],
  "metadata": {
    "source": "cursor",
    "project": "ai-spa"
  }
}
```

Router quyết định provider:

- Theo `model` explicit.
- Theo `task_type`.
- Theo client policy.
- Theo fallback khi provider lỗi.

Ví dụ mapping:

```json
{
  "claude-sonnet": {
    "provider": "anthropic",
    "provider_model": "claude-sonnet-4"
  },
  "gpt-4.1-mini": {
    "provider": "openai",
    "provider_model": "gpt-4.1-mini"
  },
  "kiro-pro": {
    "provider": "kiro-cli",
    "provider_model": "default",
    "allowed_task_types": ["coding", "review", "test-generation", "repo-analysis"]
  },
  "cheap-chat": {
    "provider": "9router",
    "provider_model": "glm-cheap"
  },
  "strong-code": {
    "provider": "9router",
    "provider_model": "anthropic-or-kiro-code"
  },
  "spa-assistant": {
    "provider": "9router",
    "provider_model": "spa-default"
  }
}
```

### 5.4 Provider Adapters

Mỗi provider adapter nên có interface chung:

```ts
interface AiProviderAdapter {
  chat(request: GatewayChatRequest): Promise<GatewayChatResponse>;
  listModels(): Promise<GatewayModel[]>;
  estimateCost?(usage: TokenUsage): CostEstimate;
}
```

Adapter chịu trách nhiệm:

- Convert request gateway sang format provider.
- Convert response provider về format gateway.
- Chuẩn hóa lỗi.
- Ghi token usage nếu provider trả về.

### 5.4.0 9router Tier-2 Provider

9router trên VPS được coi là một upstream provider adapter của Tier 1 Gateway.

Điều kiện:

- 9router đã chạy trên VPS.
- Có base URL nội bộ hoặc public URL có auth.
- Gateway giữ `NINEROUTER_API_KEY`.
- 9router xử lý fallback và format translation.

Env:

```env
NINEROUTER_BASE_URL=https://your-9router-vps.example.com
NINEROUTER_API_KEY=
NINEROUTER_TIMEOUT_SECONDS=90
```

Gateway gọi 9router bằng format thống nhất:

```json
{
  "model": "cheap-chat",
  "messages": [],
  "task_type": "chat",
  "metadata": {
    "gateway_request_id": "gwreq_...",
    "client_id": "n8n",
    "user_id": "usr_..."
  }
}
```

Audit log cần phân biệt:

- `provider=9router`
- `upstream_model=cheap-chat`
- `upstream_provider` nếu 9router trả về.
- `fallback_used=true/false` nếu 9router trả về.

9router phù hợp cho:

- GLM cheap route.
- OpenAI-compatible route.
- Anthropic fallback.
- Provider format translation.
- Cost/latency optimization.

Không nên đặt vào 9router:

- Gateway user auth.
- Internal API key management.
- AI Spa business policy.
- Audit log nhạy cảm của doanh nghiệp nếu 9router không cần biết.

### 5.4.1 Kiro Pro Backend Provider

Kiro Pro được thiết kế như backend provider thông qua Kiro CLI headless mode, không phải qua browser automation và không giả lập người dùng trên giao diện web.

Điều kiện bắt buộc:

- Máy chạy gateway phải cài `kiro-cli`.
- Tài khoản Kiro Pro phải tạo được `KIRO_API_KEY`.
- Gateway giữ `KIRO_API_KEY` trong secret/env, không đưa key cho client như n8n, Cursor hoặc AI Spa.
- Chỉ dùng non-interactive/headless command.

Luồng xử lý:

```mermaid
sequenceDiagram
    participant Client
    participant Gateway
    participant Router
    participant KiroAdapter
    participant KiroCLI

    Client->>Gateway: POST /v1/chat model=kiro-pro
    Gateway->>Router: validate client policy
    Router->>KiroAdapter: route coding/review task
    KiroAdapter->>KiroCLI: kiro-cli chat --no-interactive "<prompt>"
    KiroCLI-->>KiroAdapter: stdout / stderr / exit code
    KiroAdapter-->>Gateway: normalized GatewayChatResponse
    Gateway-->>Client: JSON response
```

Prompt conversion:

- Ghép `system` message thành phần hướng dẫn đầu prompt.
- Ghép `user` và `assistant` messages theo thứ tự hội thoại.
- Thêm metadata an toàn như `source`, `task_type`, `request_id`.
- Không inject raw secret, API key, payment data hoặc dữ liệu khách hàng spa nếu không cần thiết.

Command strategy:

```bash
KIRO_API_KEY=... kiro-cli chat --no-interactive "<compiled prompt>"
```

Nếu task cần thao tác repo/file, adapter phải chạy trong working directory được cấu hình rõ:

```env
KIRO_WORKDIR=/srv/internal-ai-gateway/kiro-workspaces/default
```

Không chạy Kiro trực tiếp trong thư mục source chính của gateway trừ khi request đó là coding task có chủ đích.

Timeout và concurrency:

- `KIRO_TIMEOUT_SECONDS=180`
- `KIRO_MAX_CONCURRENCY=2`
- `KIRO_QUEUE_MAX_PENDING=20`

Kiro CLI phù hợp cho:

- Code review.
- Sinh test.
- Phân tích repo.
- Troubleshoot build.
- Coding assistant nội bộ.
- Workflow CI/CD hoặc automation có đầu vào rõ.

Kiro CLI không nên là provider mặc định cho:

- Chat realtime với khách hàng spa.
- High-volume n8n workflow.
- Response cần latency thấp.
- JSON strict contract nếu chưa có validation/retry riêng.
- Dữ liệu nhạy cảm chưa được redaction.

Error mapping riêng cho Kiro:

```json
{
  "KIRO_CLI_NOT_FOUND": "kiro-cli is not installed or not in PATH",
  "KIRO_AUTH_FAILED": "KIRO_API_KEY is missing or invalid",
  "KIRO_TIMEOUT": "kiro-cli command exceeded configured timeout",
  "KIRO_EXIT_NON_ZERO": "kiro-cli returned a non-zero exit code",
  "KIRO_OUTPUT_PARSE_FAILED": "kiro-cli output could not be normalized"
}
```

Usage/cost tracking:

- Nếu Kiro CLI trả metadata usage, lưu theo response thật.
- Nếu CLI không trả token/cost metadata, lưu `usage.source = "unavailable"` và tính cost ở mức subscription/credit report riêng.
- Audit log vẫn phải ghi `provider=kiro-cli`, `model=kiro-pro`, `latency_ms`, `exit_code`, `timed_out`.

### 5.5 Logging & Audit

Mỗi request cần có:

- `request_id`
- `client_id`
- `provider`
- `model`
- `latency_ms`
- `status`
- `input_tokens`
- `output_tokens`
- `estimated_cost`
- `created_at`

Không lưu raw prompt mặc định. Chỉ bật prompt logging theo policy khi cần debug, và phải có redaction.

V2 audit lưu DB thay vì chỉ JSONL:

```text
audit_logs
- id
- request_id
- user_id
- api_key_id
- client_id
- model
- provider
- upstream_provider
- upstream_model
- status
- latency_ms
- input_tokens
- output_tokens
- estimated_cost
- error_code
- created_at
```

### 5.6 Rate Limit & Quota

MVP:

- Rate limit theo API key.
- Timeout mặc định theo route.
- Max body size.

Phase sau:

- Daily/monthly quota.
- Budget guardrail.
- Alert khi cost vượt ngưỡng.

V2 quota:

- Per API key request/minute.
- Per API key daily request limit.
- Per user monthly token limit.
- Per client allowed model list.
- Optional budget alert by model/provider.

### 5.7 Secrets

Không hardcode provider key trong source code.

Dùng `.env` hoặc secret manager:

```env
GATEWAY_PORT=8787
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
KIRO_API_KEY=
KIRO_CLI_BIN=kiro-cli
KIRO_WORKDIR=
KIRO_TIMEOUT_SECONDS=180
KIRO_MAX_CONCURRENCY=2
DATABASE_PROVIDER=sqlite
DATABASE_URL=file:./data/gateway.db
ADMIN_TOKEN=change-me-admin
NINEROUTER_BASE_URL=
NINEROUTER_API_KEY=
NINEROUTER_TIMEOUT_SECONDS=90
CLAUDE_CODE_GATEWAY_KEY=
CURSOR_GATEWAY_KEY=
N8N_GATEWAY_KEY=
AI_SPA_GATEWAY_KEY=
```

### 5.8 Database Schema V2

```text
users
- id
- email
- name
- role: owner | admin | member | service
- status: active | suspended
- created_at
- updated_at

clients
- id
- name
- type: human | service | workflow | spa-system | coding-tool
- owner_user_id
- status: active | suspended
- created_at
- updated_at

api_keys
- id
- user_id
- client_id
- name
- key_prefix
- key_hash
- status: active | revoked
- last_used_at
- expires_at
- created_at
- revoked_at

policies
- id
- scope_type: global | user | client | api_key
- scope_id
- allowed_models
- allowed_task_types
- rate_limit_per_minute
- daily_request_limit
- monthly_token_limit
- allow_tools
- log_prompts
- created_at
- updated_at

audit_logs
- id
- request_id
- user_id
- api_key_id
- client_id
- model
- provider
- upstream_provider
- upstream_model
- status
- latency_ms
- input_tokens
- output_tokens
- estimated_cost
- error_code
- created_at

usage_daily
- id
- date
- user_id
- api_key_id
- client_id
- request_count
- input_tokens
- output_tokens
- estimated_cost
- created_at
- updated_at
```

### 5.9 Admin Dashboard V2

Dashboard cần có các tab:

- Overview: health, provider readiness, model count, usage today.
- Users: list, create, suspend/reactivate.
- API Keys: list, create, revoke, rotate, copy key một lần.
- Policies: edit allowed models/task/quota/log prompt.
- Audit Logs: filter theo user, key, client, model, status.
- Usage: daily usage by user/key/client/provider.
- Providers: Anthropic/OpenAI/Kiro/9router readiness.
- Console: test request như dashboard hiện tại.

Admin auth giai đoạn đầu:

- `ADMIN_TOKEN` qua cookie hoặc header.
- Không dùng chung API key client cho dashboard admin.

Sau này có thể nâng lên:

- Username/password.
- Session cookie.
- OAuth/Supabase Auth nếu dùng Supabase.

## 6. API Contract MVP

### POST `/v1/chat`

Request:

```json
{
  "model": "claude-sonnet",
  "messages": [
    {
      "role": "system",
      "content": "You are an internal assistant."
    },
    {
      "role": "user",
      "content": "Write a summary."
    }
  ],
  "temperature": 0.2,
  "max_tokens": 1200,
  "metadata": {
    "source": "n8n",
    "workflow_id": "lead-intake"
  }
}
```

Response:

```json
{
  "id": "gwreq_01H...",
  "model": "claude-sonnet",
  "provider": "anthropic",
  "content": "Summary text...",
  "usage": {
    "input_tokens": 120,
    "output_tokens": 80
  },
  "latency_ms": 1430
}
```

Error:

```json
{
  "error": {
    "code": "PROVIDER_TIMEOUT",
    "message": "The upstream provider timed out.",
    "request_id": "gwreq_01H..."
  }
}
```

## 7. Gợi ý cấu trúc thư mục

```text
internal-ai-gateway/
  PLAN.md
  README.md
  package.json
  docker-compose.yml
  .env.example
  src/
    server.ts
    config/
      env.ts
      clients.ts
      models.ts
    routes/
      health.ts
      chat.ts
      models.ts
      usage.ts
    auth/
      api-key-auth.ts
      policies.ts
    providers/
      types.ts
      anthropic.ts
      openai-compatible.ts
      kiro-cli.ts
      nine-router.ts
    db/
      schema.ts
      client.ts
      migrate.ts
      seed.ts
      repositories/
        users.ts
        api-keys.ts
        policies.ts
        audit-logs.ts
        usage.ts
    router/
      model-router.ts
    queue/
      provider-queue.ts
    observability/
      logger.ts
      metrics.ts
      audit-log.ts
    admin/
      dashboard.ts
      admin-auth.ts
    errors/
      gateway-error.ts
      normalize-provider-error.ts
    tests/
      chat.test.ts
      auth.test.ts
      router.test.ts
```

## 8. Kế hoạch triển khai

### Trạng thái hiện tại

Đã triển khai:

- Fastify + TypeScript gateway.
- `/health`, `/ready`, `/v1/models`, `/v1/chat`, `/v1/usage/summary`.
- Env-based API key auth.
- Provider adapters: Anthropic, OpenAI-compatible, Kiro CLI.
- Kiro timeout/concurrency queue.
- JSONL audit log.
- Admin dashboard cơ bản tại `/admin`.
- Build/test/lint.

Tiếp theo là V2 database + multi-user + 9router.

### Phase 0: Quyết định nền tảng

Thời lượng: 0.5 ngày

- Chọn Fastify hoặc NestJS.
- Chọn database logging: SQLite/Postgres.
- Chốt provider đầu tiên: Anthropic, OpenAI-compatible, Kiro CLI, hoặc phối hợp cả ba.
- Chốt nơi chạy: local server, VPS nội bộ, Docker host, hoặc Kubernetes.
- Kiểm tra `kiro-cli` có chạy headless được bằng `KIRO_API_KEY`.

Kết quả:

- Tech stack được chốt.
- `.env.example` có danh sách secret cần thiết.

### Phase 1: Gateway Skeleton

Thời lượng: 1 ngày

- Tạo app server.
- Thêm `/health`, `/ready`.
- Thêm config loader.
- Thêm structured logger.
- Thêm Dockerfile hoặc Docker Compose.

Kết quả:

- Gateway chạy local được.
- Có health check.

### Phase 2: Auth & Policy

Thời lượng: 1 ngày

- API key middleware.
- Client registry.
- Policy validation.
- Rate limit cơ bản.

Kết quả:

- Claude Code, Cursor, n8n, AI Spa có key riêng.
- Request không hợp lệ bị chặn trước khi gọi provider.

### Phase 3: Chat API & Provider Adapter

Thời lượng: 1-2 ngày

- Tạo `/v1/chat`.
- Tạo `GatewayChatRequest` và `GatewayChatResponse`.
- Implement Anthropic adapter.
- Implement OpenAI-compatible adapter.
- Implement Kiro CLI adapter bản đầu: spawn process, timeout, stdout/stderr capture.
- Chuẩn hóa lỗi provider.

Kết quả:

- Client gọi một API thống nhất.
- Gateway routing được tới provider thật.
- `model=kiro-pro` gọi được Kiro CLI headless cho task coding/review.

### Phase 4: Observability

Thời lượng: 1 ngày

- Request id.
- Audit log.
- Usage tracking.
- Latency metric.
- Redaction cơ bản.
- Log riêng cho Kiro: `exit_code`, `timed_out`, `working_directory`, `usage.source`.

Kết quả:

- Biết client nào dùng model nào, mất bao lâu, tốn bao nhiêu token.

### Phase 5: n8n & Tool Integration

Thời lượng: 1 ngày

- Tạo ví dụ HTTP node cho n8n.
- Tạo sample request cho Claude Code/Cursor.
- Tạo sample request route sang `model=kiro-pro` cho task code review hoặc generate test.
- Thêm `/v1/tools/run` nếu AI Spa cần gọi tool nội bộ.

Kết quả:

- n8n workflow gọi gateway được.
- AI Spa có đường tích hợp chính thức.

### Phase 6: Hardening

Thời lượng: 1-2 ngày

- Timeout per provider.
- Retry có kiểm soát.
- Fallback model.
- Queue và concurrency limit cho Kiro CLI.
- Workspace sandbox cho Kiro CLI.
- Daily quota.
- Cost alert.
- Input size guard.
- Optional IP allowlist.

Kết quả:

- Gateway đủ an toàn cho vận hành nội bộ.

### Phase 7: Local Database Foundation

Thời lượng: 1 ngày

- Thêm ORM: ưu tiên Drizzle.
- Thêm SQLite local.
- Thêm schema/migration cho users, clients, api_keys, policies, audit_logs, usage_daily.
- Thêm seed data cho owner/admin và service clients: Claude Code, Cursor, n8n, AI Spa.
- Thêm env:
  - `DATABASE_PROVIDER=sqlite`
  - `DATABASE_URL=file:./data/gateway.db`
  - `ADMIN_TOKEN=...`

Kết quả:

- Gateway có DB local.
- Có seed user/client/API key ban đầu.
- Chạy local không cần online service.

### Phase 8: DB-backed Auth & API Key Management

Thời lượng: 1-2 ngày

- Tạo API key generator.
- Hash API key, chỉ lưu hash/prefix.
- Thay env-based key lookup bằng DB lookup.
- Cập nhật `last_used_at`.
- Thêm admin API:
  - list keys
  - create key
  - revoke key
  - rotate key

Kết quả:

- Có thể tạo key mới từ dashboard/admin API.
- Có thể revoke key mà không cần restart gateway.
- Env key cũ chỉ còn dùng để seed/dev fallback nếu cần.

### Phase 9: Multi-user, Client, Policy CRUD

Thời lượng: 2 ngày

- Admin API cho users.
- Admin API cho clients.
- Admin API cho policies.
- Policy resolver theo thứ tự API key -> client -> user -> global.
- Enforce allowed models/task types/rate/quota từ DB.

Kết quả:

- Quản lý nhiều user/service account.
- Mỗi key/client có quyền khác nhau.
- Dashboard có thể sửa policy vận hành.

### Phase 10: DB Audit & Usage

Thời lượng: 1-2 ngày

- Ghi audit vào DB.
- Giữ JSONL audit làm optional fallback nếu muốn.
- Tạo usage aggregation theo ngày.
- Admin API filter audit logs.
- Admin API usage daily summary.

Kết quả:

- Dashboard xem được lịch sử request.
- Biết user/key/client nào đang dùng nhiều.
- Sẵn sàng cho quota/budget guardrail.

### Phase 11: 9router Adapter

Thời lượng: 1 ngày

- Thêm `NineRouterAdapter`.
- Thêm env `NINEROUTER_BASE_URL`, `NINEROUTER_API_KEY`, `NINEROUTER_TIMEOUT_SECONDS`.
- Thêm model aliases:
  - `cheap-chat`
  - `strong-code`
  - `spa-assistant`
- Chuẩn hóa response 9router về `GatewayChatResponse`.
- Audit `provider=9router`, `upstream_provider`, `fallback_used` nếu có.

Kết quả:

- Gateway gọi được 9router như Tier-2 provider.
- Tier 1 vẫn giữ auth/policy/audit.
- 9router lo fallback/provider translation.

### Phase 12: Admin Dashboard V2

Thời lượng: 2-3 ngày

- Thêm admin token gate.
- Users tab.
- API Keys tab.
- Policies tab.
- Audit Logs tab.
- Usage tab.
- Providers tab hiển thị 9router readiness.
- Console giữ lại để test request.

Kết quả:

- Quản lý vận hành gateway qua UI.
- Không cần sửa env/restart để tạo key hoặc revoke key.

### Phase 13: VPS/Online DB Migration

Thời lượng: 1 ngày

- Chuẩn hóa repository để đổi SQLite -> Postgres.
- Thêm Postgres driver.
- Test migration với Supabase hoặc Neon.
- Cập nhật Docker Compose/VPS env.
- Backup/restore hướng dẫn.

Kết quả:

- Local vẫn dùng SQLite.
- VPS dùng online Postgres.
- Không rewrite route/auth/dashboard.

## 9. Thứ tự ưu tiên

1. Fastify/NestJS skeleton.
2. API key auth.
3. `/v1/chat`.
4. Anthropic adapter.
5. OpenAI-compatible adapter.
6. Kiro CLI adapter cho `kiro-pro`.
7. Audit logging.
8. n8n sample workflow.
9. Rate limit, quota và Kiro concurrency queue.
10. Tool calling cho AI Spa.
11. Dashboard hoặc báo cáo usage.
12. SQLite local database.
13. DB-backed API key management.
14. Multi-user/policy admin.
15. 9router adapter.
16. DB-backed audit/usage dashboard.
17. Postgres online migration khi deploy VPS.

## 10. Rủi ro cần kiểm soát

- Prompt hoặc dữ liệu khách hàng spa bị log thô.
- API key bị commit vào git.
- n8n workflow gọi gateway không có rate limit.
- Provider timeout làm treo workflow.
- Response format mỗi provider khác nhau gây lỗi client.
- Không có cost tracking dẫn tới phát sinh chi phí khó kiểm soát.
- Gateway bị public ra internet ngoài ý muốn.
- Kiro CLI bị gọi song song quá nhiều làm nghẽn máy chạy gateway.
- Kiro CLI thao tác nhầm working directory hoặc đọc/ghi file ngoài phạm vi cho phép.
- Dùng Kiro cho chat realtime/high-volume khiến latency và reliability kém.
- Không lấy được token usage từ Kiro CLI nên báo cáo cost không chính xác như API provider.
- Lưu raw API key trong DB hoặc log.
- Admin dashboard bị public mà không có admin auth.
- Policy DB sai làm user dùng được model không nên dùng.
- SQLite local bị coi như production DB lâu dài mà không backup.
- Chuyển Postgres muộn nhưng code đã phụ thuộc SQLite-specific.
- 9router và gateway cùng fallback phức tạp làm khó truy vết lỗi.
- Online Postgres connection string bị lộ hoặc không bật SSL.

## 11. Definition of Done cho MVP

- Gateway chạy bằng một lệnh local hoặc Docker Compose.
- Có `.env.example`.
- Có `/health` và `/ready`.
- Có `/v1/chat` hoạt động với ít nhất một provider thật.
- Có `model=kiro-pro` hoạt động qua Kiro CLI headless nếu `KIRO_API_KEY` được cấu hình.
- Có API key auth cho 4 client nội bộ.
- Có rate limit cơ bản.
- Có timeout và concurrency limit riêng cho Kiro CLI.
- Có audit log không lưu raw prompt mặc định.
- Có tài liệu request/response mẫu.
- Có test cho auth, routing và chat happy path.

## 11.1 Definition of Done cho V2 Multi-user

- Có SQLite local database chạy bằng `DATABASE_URL=file:...`.
- Có migration/schema rõ ràng.
- Có seed owner/admin và service clients.
- Có API key generator, hash, prefix lookup.
- Có create/revoke/rotate API key.
- Có users/clients/policies CRUD tối thiểu.
- `/v1/chat` dùng DB-backed auth/policy.
- Audit log ghi DB.
- Usage summary đọc từ DB.
- Admin dashboard quản lý user/key/policy/audit/usage.
- Có 9router adapter.
- Có test cho key creation, key auth, revoked key, policy deny, 9router route.
- Có tài liệu chuyển sang Postgres online khi deploy VPS.

## 12. Đề xuất quyết định ban đầu

Để đi nhanh, nên bắt đầu với:

- Runtime: Node.js + TypeScript
- Framework: Fastify
- Validation: Zod
- Logging: Pino
- Rate limit: `@fastify/rate-limit`
- Kiro integration: `node:child_process` hoặc `execa`
- Kiro execution control: queue nội bộ bằng `p-queue`
- Database local: SQLite
- Database production: Postgres online, ưu tiên Supabase hoặc Neon
- Local DB implementation: Node built-in SQLite + repository layer
- Postgres migration option: Drizzle hoặc driver Postgres qua cùng repository layer
- Admin bootstrap auth: `ADMIN_TOKEN`
- Deployment MVP: Docker Compose

Sau khi V2 ổn định, có thể nâng lên Postgres online, Redis rate limit, Prometheus/Grafana và dashboard nội bộ đầy đủ hơn.

## 13. Cách chuyển local DB sang online DB sau này

Giai đoạn local:

```env
DATABASE_PROVIDER=sqlite
DATABASE_URL=file:./data/gateway.db
```

Giai đoạn VPS:

```env
DATABASE_PROVIDER=postgres
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require
```

Các bước chuyển:

1. Tạo Supabase hoặc Neon Postgres.
2. Copy connection string vào `.env` trên VPS.
3. Chạy migration.
4. Chạy seed admin nếu DB mới.
5. Deploy gateway Docker.
6. Test `/ready`, `/admin`, `/v1/models`.
7. Tạo lại API key production từ dashboard.
8. Revoke key test/dev nếu không dùng.

Không migrate raw local API key secret. Nếu cần migrate key, chỉ migrate hash/prefix và vẫn phải đảm bảo pepper/secret giống nhau. Cách an toàn hơn là tạo key production mới.
