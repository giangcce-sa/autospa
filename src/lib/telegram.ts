import { prisma } from "@/lib/db";

const BASE = "https://api.telegram.org";

async function getCreds(): Promise<{ token: string; chatId: string } | null> {
  const s = await prisma.settings.findFirst();
  if (!s?.telegramBotToken || !s?.telegramChatId) return null;
  return { token: s.telegramBotToken, chatId: s.telegramChatId };
}

async function call(token: string, method: string, body: Record<string, unknown>) {
  const res = await fetch(`${BASE}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function sendMessage(text: string, parseMode: "Markdown" | "HTML" = "Markdown") {
  const creds = await getCreds();
  if (!creds) return { ok: false, error: "Telegram chưa được cấu hình" };
  return call(creds.token, "sendMessage", {
    chat_id: creds.chatId,
    text,
    parse_mode: parseMode,
    disable_web_page_preview: true,
  });
}

export async function sendPhoto(photoUrl: string, caption?: string) {
  const creds = await getCreds();
  if (!creds) return { ok: false, error: "Telegram chưa được cấu hình" };
  return call(creds.token, "sendPhoto", {
    chat_id: creds.chatId,
    photo: photoUrl,
    caption,
    parse_mode: "Markdown",
  });
}

export async function sendAlert(title: string, body: string, severity: "critical" | "warning" | "info" = "info") {
  const creds = await getCreds();
  if (!creds) return { ok: false };
  const s = await prisma.settings.findFirst();
  if (!s?.telegramAlerts) return { ok: false, error: "Alerts tắt" };

  const icon = severity === "critical" ? "🚨" : severity === "warning" ? "⚠️" : "ℹ️";
  const text = `${icon} *${title}*\n\n${body}\n\n_${new Date().toLocaleString("vi-VN")}_`;
  return call(creds.token, "sendMessage", {
    chat_id: creds.chatId,
    text,
    parse_mode: "Markdown",
  });
}

export async function testConnection(token: string, chatId: string) {
  try {
    const res = await call(token, "sendMessage", {
      chat_id: chatId,
      text: "✅ *AutoSpa* đã kết nối Telegram thành công!",
      parse_mode: "Markdown",
    });
    return { ok: res.ok, error: res.description };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
