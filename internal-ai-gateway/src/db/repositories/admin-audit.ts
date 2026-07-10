import { nanoid } from "nanoid";
import { dispatchWebhook } from "../../observability/webhook-dispatcher.js";
import { getDb } from "../client.js";

export type AdminAuditLogRow = {
  id: string;
  action: string;
  actor: string;
  target_type: string | null;
  target_id: string | null;
  metadata: string;
  created_at: string;
};

export function recordAdminAction(input: {
  action: string;
  actor?: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}): void {
  const createdAt = new Date().toISOString();
  const id = `adm_${nanoid(12)}`;
  getDb()
    .prepare(
      `INSERT INTO admin_audit_logs (id, action, actor, target_type, target_id, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      input.action,
      input.actor ?? "admin",
      input.targetType ?? null,
      input.targetId ?? null,
      JSON.stringify(input.metadata ?? {}),
      createdAt
    );
  dispatchWebhook("admin.action", {
    id,
    action: input.action,
    actor: input.actor ?? "admin",
    target_type: input.targetType ?? null,
    target_id: input.targetId ?? null,
    created_at: createdAt
  }).catch(() => {});
}

export function listAdminAuditLogs(limit = 100): AdminAuditLogRow[] {
  return getDb()
    .prepare("SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT ?")
    .all(Math.min(Math.max(limit, 1), 500)) as AdminAuditLogRow[];
}
