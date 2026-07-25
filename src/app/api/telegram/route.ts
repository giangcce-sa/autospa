import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import {
  deleteTelegramWebhook,
  getTelegramWebhookInfo,
  sendMessage,
  setTelegramWebhook,
  testConnection,
} from "@/lib/telegram";
import { prisma } from "@/lib/db";
import { trustedTelegramBaseUrl } from "@/lib/channel-security";
import { accessErrorResponse, requireUser } from "@/lib/page-access";
import { getTelegramSettings, saveTelegramSettings } from "@/lib/settings/channels";
import { ZodError } from "zod";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser({ owner: true });
    const body = await req.json();
    const { action } = body;

    if (action === "test") {
      const { token, chatId } = body;
      const settings = await prisma.settings.findFirst();
      const resolvedToken = token && !String(token).includes("•") ? String(token) : settings?.telegramBotToken;
      if (!resolvedToken || !chatId) {
        return NextResponse.json({ success: false, message: "Cần nhập Bot Token và Chat ID" });
      }
      const result = await testConnection(resolvedToken, String(chatId));
      return NextResponse.json({
        success: result.ok,
        message: result.ok ? "Kết nối thành công! Kiểm tra Telegram của bạn." : `Lỗi: ${result.error}`,
      });
    }

    if (action === "send-test-report") {
      const { generateWeeklyReport } = await import("@/lib/weekly-report");
      const text = await generateWeeklyReport();
      const result = await sendMessage(text);
      return NextResponse.json({ success: result.ok, message: result.ok ? "Đã gửi báo cáo thử nghiệm!" : result.description });
    }

    if (action === "save") {
      const data = await saveTelegramSettings(body, {
        userId: user.id ?? user.email ?? "owner",
        href: "/system/settings?view=channels&scope=account",
        source: "telegram_settings_api",
      });
      return NextResponse.json({ success: true, data });
    }

    if (action === "get") {
      return NextResponse.json({ success: true, data: await getTelegramSettings() });
    }

    if (action === "register-webhook") {
      const settings = await prisma.settings.findFirst();
      if (!settings?.telegramBotToken || !settings.telegramChatId) {
        return NextResponse.json({ success: false, error: "Cần lưu Bot Token và Chat ID trước" }, { status: 400 });
      }
      if (settings.telegramChatId.startsWith("-") && !settings.telegramAdminUserId) {
        return NextResponse.json({ success: false, error: "Group chat cần cấu hình Admin User ID" }, { status: 400 });
      }
      let baseUrl: string;
      try {
        baseUrl = trustedTelegramBaseUrl({
          autospaBaseUrl: process.env.AUTOSPA_BASE_URL || process.env.NEXT_PUBLIC_APP_URL,
          authUrl: process.env.AUTH_URL || process.env.NEXTAUTH_URL,
          requestOrigin: req.nextUrl.origin,
          production: process.env.NODE_ENV === "production",
        });
      } catch {
        return NextResponse.json({ success: false, error: "Webhook cần domain HTTPS công khai" }, { status: 400 });
      }
      const secret = randomBytes(24).toString("hex");
      const webhookUrl = `${baseUrl}/api/webhook/telegram`;
      const result = await setTelegramWebhook(settings.telegramBotToken, webhookUrl, secret);
      if (!result.ok) {
        return NextResponse.json({ success: false, error: result.description ?? result.error }, { status: 502 });
      }
      await prisma.settings.update({
        where: { id: settings.id },
        data: { telegramWebhookSecret: secret, telegramWebhookUrl: webhookUrl, telegramWebhookAt: new Date() },
      });
      return NextResponse.json({ success: true, message: "Đã đăng ký Telegram webhook", data: { webhookUrl } });
    }

    if (action === "webhook-status") {
      const settings = await prisma.settings.findFirst();
      if (!settings?.telegramBotToken) {
        return NextResponse.json({ success: false, error: "Telegram chưa cấu hình" }, { status: 400 });
      }
      const result = await getTelegramWebhookInfo(settings.telegramBotToken);
      return NextResponse.json({
        success: result.ok,
        data: result.result,
        error: result.description ?? result.error,
      }, { status: result.ok ? 200 : 502 });
    }

    if (action === "delete-webhook") {
      const settings = await prisma.settings.findFirst();
      if (!settings?.telegramBotToken) {
        return NextResponse.json({ success: false, error: "Telegram chưa cấu hình" }, { status: 400 });
      }
      const result = await deleteTelegramWebhook(settings.telegramBotToken);
      if (result.ok) {
        await prisma.settings.update({
          where: { id: settings.id },
          data: { telegramWebhookSecret: null, telegramWebhookUrl: null, telegramWebhookAt: null },
        });
      }
      return NextResponse.json({ success: result.ok, error: result.description ?? result.error });
    }

    return NextResponse.json({ success: false, message: "Action không hợp lệ" });
  } catch (e) {
    const access = accessErrorResponse(e);
    if (access) return access;
    const message = e instanceof ZodError ? e.issues[0]?.message ?? "Cấu hình Telegram không hợp lệ" : String(e);
    return NextResponse.json({ error: message, success: false }, { status: e instanceof ZodError ? 400 : 500 });
  }
}
