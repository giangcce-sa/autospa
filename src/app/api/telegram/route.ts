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

export async function POST(req: NextRequest) {
  try {
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
      const { telegramBotToken, telegramChatId, telegramAdminUserId, telegramAlerts, weeklyReportEnabled, weeklyReportDay, weeklyReportHour } = body;
      const updateData: Record<string, string | boolean | number | null> = {};
      if (telegramBotToken?.trim() && !telegramBotToken.includes("•")) updateData.telegramBotToken = telegramBotToken.trim();
      if (telegramChatId !== undefined) updateData.telegramChatId = telegramChatId.trim() || null;
      if (telegramAdminUserId !== undefined) updateData.telegramAdminUserId = telegramAdminUserId.trim() || null;
      if (telegramAlerts !== undefined) updateData.telegramAlerts = Boolean(telegramAlerts);
      if (weeklyReportEnabled !== undefined) updateData.weeklyReportEnabled = Boolean(weeklyReportEnabled);
      if (weeklyReportDay !== undefined) {
        const day = Number(weeklyReportDay);
        if (!Number.isInteger(day) || day < 0 || day > 6) {
          return NextResponse.json({ success: false, error: "Ngày báo cáo không hợp lệ" }, { status: 400 });
        }
        updateData.weeklyReportDay = day;
      }
      if (weeklyReportHour !== undefined) {
        const hour = Number(weeklyReportHour);
        if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
          return NextResponse.json({ success: false, error: "Giờ báo cáo không hợp lệ" }, { status: 400 });
        }
        updateData.weeklyReportHour = hour;
      }

      await prisma.settings.upsert({ where: { id: "1" }, update: updateData, create: { id: "1", ...updateData } });
      return NextResponse.json({ success: true });
    }

    if (action === "get") {
      const [s, lastDelivery] = await Promise.all([
        prisma.settings.findFirst(),
        prisma.telegramDelivery.findFirst({ orderBy: { createdAt: "desc" } }),
      ]);
      return NextResponse.json({
        success: true,
        data: {
          hasBotToken: !!s?.telegramBotToken,
          botTokenMasked: s?.telegramBotToken ? "•••••••" + s.telegramBotToken.slice(-6) : null,
          telegramChatId: s?.telegramChatId ?? "",
          telegramAdminUserId: s?.telegramAdminUserId ?? "",
          telegramAlerts: s?.telegramAlerts ?? true,
          weeklyReportEnabled: s?.weeklyReportEnabled ?? true,
          weeklyReportDay: s?.weeklyReportDay ?? 1,
          weeklyReportHour: s?.weeklyReportHour ?? 8,
          webhookConfigured: Boolean(s?.telegramWebhookAt && s.telegramWebhookUrl),
          webhookUrl: s?.telegramWebhookUrl ?? null,
          lastDelivery: lastDelivery ? {
            status: lastDelivery.status,
            type: lastDelivery.type,
            error: lastDelivery.error,
            createdAt: lastDelivery.createdAt,
          } : null,
        },
      });
    }

    if (action === "register-webhook") {
      const settings = await prisma.settings.findFirst();
      if (!settings?.telegramBotToken || !settings.telegramChatId) {
        return NextResponse.json({ success: false, error: "Cần lưu Bot Token và Chat ID trước" }, { status: 400 });
      }
      if (settings.telegramChatId.startsWith("-") && !settings.telegramAdminUserId) {
        return NextResponse.json({ success: false, error: "Group chat cần cấu hình Admin User ID" }, { status: 400 });
      }
      const baseUrl = String(body.baseUrl || process.env.AUTOSPA_BASE_URL || process.env.NEXTAUTH_URL || req.nextUrl.origin)
        .replace(/\/$/, "");
      if (!baseUrl.startsWith("https://") || /localhost|127\.0\.0\.1/.test(baseUrl)) {
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
    return NextResponse.json({ error: String(e), success: false }, { status: 500 });
  }
}
