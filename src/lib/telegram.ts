import { prisma } from "@/lib/db";
import { splitTelegramText } from "@/lib/telegram-control";

const BASE = "https://api.telegram.org";

export type TelegramResult<T = Record<string, unknown>> = {
  ok: boolean;
  result?: T;
  description?: string;
  error?: string;
};

type TelegramCreds = { token: string; chatId: string };

async function getCreds(): Promise<TelegramCreds | null> {
  const settings = await prisma.settings.findFirst();
  if (!settings?.telegramBotToken || !settings.telegramChatId) return null;
  return { token: settings.telegramBotToken, chatId: settings.telegramChatId };
}

async function call<T = Record<string, unknown>>(
  token: string,
  method: string,
  body: Record<string, unknown>,
): Promise<TelegramResult<T>> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(`${BASE}/bot${token}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(12_000),
      });
      const data = await response.json().catch(() => ({})) as TelegramResult<T> & {
        parameters?: { retry_after?: number };
      };
      if (response.ok && data.ok) return data;
      if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
        const delayMs = Math.min((data.parameters?.retry_after ?? 1) * 1_000, 5_000);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      return { ok: false, description: data.description ?? `Telegram HTTP ${response.status}` };
    } catch (error) {
      if (attempt === 0) continue;
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
  return { ok: false, error: "Telegram request failed" };
}

async function recordDelivery(
  type: string,
  chatId: string,
  result: TelegramResult<{ message_id?: number }>,
  metadata?: unknown,
) {
  await prisma.telegramDelivery.create({
    data: {
      type,
      chatId,
      status: result.ok ? "sent" : "failed",
      telegramMessageId: result.result?.message_id != null ? String(result.result.message_id) : null,
      error: result.ok ? null : result.description ?? result.error ?? "Telegram request failed",
      metadata: metadata == null ? null : JSON.stringify(metadata),
    },
  }).catch(() => null);
}

export async function sendMessage(
  text: string,
  parseMode: "Markdown" | "HTML" = "Markdown",
  options?: { type?: string; replyMarkup?: Record<string, unknown>; chatId?: string; metadata?: unknown },
) {
  const creds = await getCreds();
  if (!creds) return { ok: false, error: "Telegram chưa được cấu hình" };
  const chatId = options?.chatId ?? creds.chatId;
  const chunks = splitTelegramText(text);
  let lastResult: TelegramResult<{ message_id?: number }> = { ok: false, error: "Không có nội dung" };
  for (const [index, chunk] of chunks.entries()) {
    lastResult = await call<{ message_id?: number }>(creds.token, "sendMessage", {
      chat_id: chatId,
      text: chunk,
      parse_mode: parseMode,
      disable_web_page_preview: true,
      ...(options?.replyMarkup && index === chunks.length - 1 ? { reply_markup: options.replyMarkup } : {}),
    });
    await recordDelivery(options?.type ?? "message", chatId, lastResult, {
      ...((options?.metadata as Record<string, unknown> | undefined) ?? {}),
      chunk: index + 1,
      chunks: chunks.length,
    });
    if (!lastResult.ok) break;
  }
  return lastResult;
}

export async function sendPhoto(photoUrl: string, caption?: string) {
  const creds = await getCreds();
  if (!creds) return { ok: false, error: "Telegram chưa được cấu hình" };
  const result = await call<{ message_id?: number }>(creds.token, "sendPhoto", {
    chat_id: creds.chatId,
    photo: photoUrl,
    caption,
    parse_mode: "Markdown",
  });
  await recordDelivery("photo", creds.chatId, result);
  return result;
}

export async function sendAlert(title: string, body: string, severity: "critical" | "warning" | "info" = "info") {
  const settings = await prisma.settings.findFirst();
  if (!settings?.telegramAlerts) return { ok: false, error: "Alerts tắt" };
  const icon = severity === "critical" ? "🚨" : severity === "warning" ? "⚠️" : "ℹ️";
  const text = `${icon} *${title}*\n\n${body}\n\n_${new Date().toLocaleString("vi-VN")}_`;
  return sendMessage(text, "Markdown", { type: "alert", metadata: { severity, title } });
}

export async function sendApprovalMessage(input: {
  approvalId: string;
  title: string;
  detail: string;
}) {
  return sendMessage(
    `*${input.title}*\n\n${input.detail}`,
    "Markdown",
    {
      type: "approval",
      metadata: { approvalId: input.approvalId },
      replyMarkup: {
        inline_keyboard: [[
          { text: "Duyệt", callback_data: `approval:Y:${input.approvalId}` },
          { text: "Từ chối", callback_data: `approval:N:${input.approvalId}` },
        ]],
      },
    },
  );
}

export async function editMessage(
  chatId: string,
  messageId: number,
  text: string,
) {
  const creds = await getCreds();
  if (!creds) return { ok: false, error: "Telegram chưa được cấu hình" };
  return call(creds.token, "editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "Markdown",
  });
}

export async function answerCallbackQuery(callbackQueryId: string, text: string) {
  const creds = await getCreds();
  if (!creds) return { ok: false, error: "Telegram chưa được cấu hình" };
  return call(creds.token, "answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
    show_alert: false,
  });
}

export async function testConnection(token: string, chatId: string) {
  const identity = await call<{ username?: string; first_name?: string }>(token, "getMe", {});
  if (!identity.ok) return identity;
  const chat = await call(token, "getChat", { chat_id: chatId });
  if (!chat.ok) return chat;
  const sent = await call<{ message_id?: number }>(token, "sendMessage", {
    chat_id: chatId,
    text: "✅ *AutoSpa* đã kết nối Telegram thành công!",
    parse_mode: "Markdown",
  });
  await recordDelivery("connection_test", chatId, sent, { bot: identity.result?.username });
  return sent;
}

export async function setTelegramWebhook(token: string, url: string, secret: string) {
  return call(token, "setWebhook", {
    url,
    secret_token: secret,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
}

export async function deleteTelegramWebhook(token: string) {
  return call(token, "deleteWebhook", { drop_pending_updates: true });
}

export async function getTelegramWebhookInfo(token: string) {
  return call<{
    url?: string;
    pending_update_count?: number;
    last_error_message?: string;
  }>(token, "getWebhookInfo", {});
}
