import { getDb } from "../client.js";

export function claimAlertCooldown(input: {
  event: string;
  identity: string;
  cooldownMs: number;
  nowMs?: number;
}): boolean {
  const nowMs = input.nowMs ?? Date.now();
  const cutoff = nowMs - input.cooldownMs;
  const db = getDb();

  db.prepare(
    `INSERT OR IGNORE INTO alert_cooldowns (event, identity, last_sent_at)
     VALUES (?, ?, 0)`
  ).run(input.event, input.identity);

  const result = db.prepare(
    `UPDATE alert_cooldowns
     SET last_sent_at = ?
     WHERE event = ? AND identity = ? AND last_sent_at <= ?`
  ).run(nowMs, input.event, input.identity, cutoff);

  return Number(result.changes ?? 0) > 0;
}
