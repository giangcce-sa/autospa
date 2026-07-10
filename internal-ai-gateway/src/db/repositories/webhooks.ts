import { nanoid } from "nanoid";
import { getDb } from "../client.js";

export type WebhookRow = {
  id: string;
  name: string;
  url: string;
  events: string;
  secret: string | null;
  enabled: number;
  last_triggered_at: string | null;
  last_status: number | null;
  failure_count: number;
  created_at: string;
  updated_at: string;
};

export type CreateWebhookInput = {
  name: string;
  url: string;
  events: string[];
  secret?: string;
};

export const WEBHOOK_EVENTS = ["key.created", "key.revoked", "quota.warning", "provider.down", "admin.action"] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export type PublicWebhookRow = Omit<WebhookRow, "secret"> & { secret_configured: boolean };

function publicWebhook(row: WebhookRow): PublicWebhookRow {
  const { secret, ...rest } = row;
  return { ...rest, secret_configured: Boolean(secret) };
}

export function listWebhooks(): PublicWebhookRow[] {
  const rows = getDb().prepare("SELECT * FROM webhooks ORDER BY created_at DESC").all() as WebhookRow[];
  return rows.map(publicWebhook);
}

export function createWebhook(input: CreateWebhookInput): WebhookRow {
  const id = `wh_${nanoid(12)}`;
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO webhooks (id, name, url, events, secret, enabled, failure_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?)`
    )
    .run(id, input.name, input.url, JSON.stringify(input.events), input.secret ?? null, now, now);
  return getDb().prepare("SELECT * FROM webhooks WHERE id = ?").get(id) as WebhookRow;
}

export function updateWebhook(
  id: string,
  input: Partial<{ name: string; url: string; events: string[]; secret: string | null; enabled: boolean }>
): WebhookRow | null {
  const row = getDb().prepare("SELECT * FROM webhooks WHERE id = ?").get(id) as WebhookRow | undefined;
  if (!row) return null;
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `UPDATE webhooks SET
         name = ?, url = ?, events = ?, secret = ?, enabled = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(
      input.name ?? row.name,
      input.url ?? row.url,
      input.events ? JSON.stringify(input.events) : row.events,
      input.secret !== undefined ? input.secret : row.secret,
      input.enabled !== undefined ? (input.enabled ? 1 : 0) : row.enabled,
      now,
      id
    );
  return getDb().prepare("SELECT * FROM webhooks WHERE id = ?").get(id) as WebhookRow;
}

export function deleteWebhook(id: string): boolean {
  const result = getDb().prepare("DELETE FROM webhooks WHERE id = ?").run(id);
  return Number(result.changes ?? 0) > 0;
}

export function getWebhooksForEvent(event: WebhookEvent): WebhookRow[] {
  return (getDb().prepare("SELECT * FROM webhooks WHERE enabled = 1").all() as WebhookRow[]).filter((wh) => {
    try {
      const events = JSON.parse(wh.events) as string[];
      return events.includes(event);
    } catch {
      return false;
    }
  });
}

export function recordWebhookResult(id: string, status: number, success: boolean): void {
  const now = new Date().toISOString();
  if (success) {
    getDb()
      .prepare(
        "UPDATE webhooks SET last_triggered_at = ?, last_status = ?, failure_count = 0, updated_at = ? WHERE id = ?"
      )
      .run(now, status, now, id);
  } else {
    getDb()
      .prepare(
        "UPDATE webhooks SET last_triggered_at = ?, last_status = ?, failure_count = failure_count + 1, updated_at = ? WHERE id = ?"
      )
      .run(now, status, now, id);
  }
}
