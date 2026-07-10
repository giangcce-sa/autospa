import "dotenv/config";
import { z } from "zod";

const optionalUrl = z.preprocess((value) => (value === "" ? undefined : value), z.string().url().optional());
const optionalString = z.preprocess((value) => (value === "" ? undefined : value), z.string().optional());
const booleanString = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  return value;
}, z.boolean());

const envSchema = z.object({
  GATEWAY_HOST: z.string().default("0.0.0.0"),
  GATEWAY_PORT: z.coerce.number().int().positive().default(8787),
  TRUST_PROXY: booleanString.default(false),
  REQUEST_BODY_LIMIT_BYTES: z.coerce.number().int().positive().default(8 * 1024 * 1024),
  MAX_MEDIA_BASE64_BYTES: z.coerce.number().int().positive().default(6 * 1024 * 1024),
  PROVIDER_ALERT_COOLDOWN_SECONDS: z.coerce.number().int().nonnegative().default(300),
  LOG_LEVEL: z.string().default("info"),
  PUBLIC_BASE_URL: optionalUrl,
  AUDIT_LOG_PATH: z.string().default("./audit-logs/gateway.jsonl"),
  DATABASE_PROVIDER: z.enum(["sqlite", "postgres"]).default("sqlite"),
  DATABASE_URL: z.string().default("file:./data/gateway.db"),
  ADMIN_TOKEN: z.string().default("change-me-admin"),
  ADMIN_SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(28800),
  KEY_PEPPER: z.string().default("change-this-key-pepper-before-production"),

  ANTHROPIC_API_KEY: optionalString,
  ANTHROPIC_BASE_URL: z.string().url().default("https://api.anthropic.com"),
  ANTHROPIC_VERSION: z.string().default("2023-06-01"),

  OPENAI_API_KEY: optionalString,
  OPENAI_BASE_URL: z.string().url().default("https://api.openai.com/v1"),

  NINEROUTER_BASE_URL: optionalUrl,
  NINEROUTER_API_KEY: optionalString,
  NINEROUTER_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(90),
  NINEROUTER_INITIAL_PASSWORD: optionalString,
  NINEROUTER_JWT_SECRET: optionalString,
  NINEROUTER_API_KEY_SECRET: optionalString,
  NINEROUTER_MACHINE_ID_SALT: optionalString,

  KIRO_API_KEY: optionalString,
  KIRO_CLI_BIN: z.string().default("kiro-cli"),
  KIRO_WORKDIR: z.string().default("./kiro-workspaces/default"),
  KIRO_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(180),
  KIRO_MAX_CONCURRENCY: z.coerce.number().int().positive().default(2),
  KIRO_QUEUE_MAX_PENDING: z.coerce.number().int().nonnegative().default(20),

  CLAUDE_CODE_GATEWAY_KEY: optionalString,
  CURSOR_GATEWAY_KEY: optionalString,
  N8N_GATEWAY_KEY: optionalString,
  AI_SPA_GATEWAY_KEY: optionalString
});

export type GatewayEnv = z.infer<typeof envSchema>;

const _parsed = envSchema.parse(process.env);

if (_parsed.DATABASE_PROVIDER === "postgres") {
  throw new Error("FATAL: DATABASE_PROVIDER=postgres is not implemented yet. Use sqlite until the database adapter is added.");
}

if (process.env.NODE_ENV === "production") {
  if (_parsed.ADMIN_TOKEN === "change-me-admin") {
    throw new Error("FATAL: ADMIN_TOKEN must be changed before running in production");
  }
  if (_parsed.KEY_PEPPER === "change-this-key-pepper-before-production") {
    throw new Error("FATAL: KEY_PEPPER must be changed before running in production");
  }
  const unsafeNineRouterSecrets = [
    _parsed.NINEROUTER_INITIAL_PASSWORD,
    _parsed.NINEROUTER_JWT_SECRET,
    _parsed.NINEROUTER_API_KEY_SECRET,
    _parsed.NINEROUTER_MACHINE_ID_SALT
  ].filter((value) => !value || value.startsWith("change-") || value.startsWith("replace-with-"));
  if (_parsed.NINEROUTER_BASE_URL && unsafeNineRouterSecrets.length > 0) {
    throw new Error("FATAL: all 9Router production secrets must be set to non-placeholder values");
  }
}

export const env = _parsed;
