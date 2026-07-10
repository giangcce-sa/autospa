import { mkdir, appendFile } from "node:fs/promises";
import { dirname } from "node:path";
import { env } from "../config/env.js";
import type { ProviderName } from "../config/models.js";
import { insertAuditLog } from "../db/repositories/audit-logs.js";
import { claimAlertCooldown } from "../db/repositories/alert-cooldowns.js";
import { incrementUsage } from "../db/repositories/usage.js";
import { dispatchWebhook } from "./webhook-dispatcher.js";

export type AuditRecord = {
  request_id: string;
  user_id?: string | null;
  api_key_id?: string | null;
  client_id: string;
  provider?: ProviderName;
  upstream_provider?: string | null;
  upstream_model?: string | null;
  model?: string;
  latency_ms: number;
  status: "ok" | "error";
  input_tokens?: number | null;
  output_tokens?: number | null;
  estimated_cost?: number | null;
  error_code?: string;
  exit_code?: number | null;
  timed_out?: boolean;
  working_directory?: string;
  usage_source?: "provider" | "estimated" | "unavailable";
  created_at: string;
};

export async function writeAuditLog(record: AuditRecord): Promise<void> {
  insertAuditLog(record);
  incrementUsage(record);
  if (
    record.status === "error" &&
    record.provider &&
    claimAlertCooldown({
      event: "provider.down",
      identity: record.provider,
      cooldownMs: env.PROVIDER_ALERT_COOLDOWN_SECONDS * 1000
    })
  ) {
    dispatchWebhook("provider.down", {
      request_id: record.request_id,
      provider: record.provider,
      model: record.model ?? null,
      error_code: record.error_code ?? null,
      latency_ms: record.latency_ms,
      created_at: record.created_at
    }).catch(() => {});
  }
  try {
    await mkdir(dirname(env.AUDIT_LOG_PATH), { recursive: true });
    await appendFile(env.AUDIT_LOG_PATH, `${JSON.stringify(record)}\n`, "utf8");
  } catch (err) {
    process.stderr.write(`[audit] Failed to write to ${env.AUDIT_LOG_PATH}: ${(err as Error).message}\n`);
  }
}
