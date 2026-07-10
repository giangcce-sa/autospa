import { createHmac } from "node:crypto";
import { logger } from "./logger.js";
import { getWebhooksForEvent, recordWebhookResult, type WebhookEvent } from "../db/repositories/webhooks.js";
import { assertSafeWebhookUrl } from "./webhook-url.js";

export type WebhookPayload = {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, unknown>;
};

export async function dispatchWebhook(event: WebhookEvent, data: Record<string, unknown>): Promise<void> {
  let hooks;
  try {
    hooks = getWebhooksForEvent(event);
  } catch {
    return;
  }
  if (hooks.length === 0) return;

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data
  };
  const body = JSON.stringify(payload);

  await Promise.allSettled(
    hooks.map(async (hook) => {
      const headers: Record<string, string> = {
        "content-type": "application/json",
        "x-gateway-event": event,
        "x-gateway-timestamp": payload.timestamp
      };
      if (hook.secret) {
        const sig = createHmac("sha256", hook.secret).update(body).digest("hex");
        headers["x-gateway-signature"] = `sha256=${sig}`;
      }

      let status = 0;
      let success = false;
      try {
        const safeUrl = await assertSafeWebhookUrl(hook.url);
        const res = await fetch(safeUrl, {
          method: "POST",
          headers,
          body,
          redirect: "error",
          signal: AbortSignal.timeout(10_000)
        });
        status = res.status;
        success = res.ok;
        if (!success) {
          logger.warn({ hookId: hook.id, url: hook.url, status }, "Webhook delivery failed");
        }
      } catch (err) {
        logger.warn({ hookId: hook.id, url: hook.url, err }, "Webhook delivery error");
      }
      try {
        recordWebhookResult(hook.id, status, success);
      } catch {
        /* ignore */
      }
    })
  );
}
