import { NextRequest, NextResponse } from "next/server";
import { testConnection, sendMessage } from "@/lib/telegram";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "test") {
      const { token, chatId } = body;
      if (!token || !chatId) {
        return NextResponse.json({ success: false, message: "Cần nhập Bot Token và Chat ID" });
      }
      const result = await testConnection(token, chatId);
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
      const { telegramBotToken, telegramChatId, telegramAlerts, weeklyReportEnabled, weeklyReportDay, weeklyReportHour } = body;
      const updateData: Record<string, string | boolean | number | null> = {};
      if (telegramBotToken?.trim() && !telegramBotToken.includes("•")) updateData.telegramBotToken = telegramBotToken.trim();
      if (telegramChatId?.trim()) updateData.telegramChatId = telegramChatId.trim();
      if (telegramAlerts !== undefined) updateData.telegramAlerts = Boolean(telegramAlerts);
      if (weeklyReportEnabled !== undefined) updateData.weeklyReportEnabled = Boolean(weeklyReportEnabled);
      if (weeklyReportDay !== undefined) updateData.weeklyReportDay = Number(weeklyReportDay);
      if (weeklyReportHour !== undefined) updateData.weeklyReportHour = Number(weeklyReportHour);

      await prisma.settings.upsert({ where: { id: "1" }, update: updateData, create: { id: "1", ...updateData } });
      return NextResponse.json({ success: true });
    }

    if (action === "get") {
      const s = await prisma.settings.findFirst();
      return NextResponse.json({
        success: true,
        data: {
          hasBotToken: !!s?.telegramBotToken,
          botTokenMasked: s?.telegramBotToken ? "•••••••" + s.telegramBotToken.slice(-6) : null,
          telegramChatId: s?.telegramChatId ?? "",
          telegramAlerts: s?.telegramAlerts ?? true,
          weeklyReportEnabled: s?.weeklyReportEnabled ?? true,
          weeklyReportDay: s?.weeklyReportDay ?? 1,
          weeklyReportHour: s?.weeklyReportHour ?? 8,
        },
      });
    }

    return NextResponse.json({ success: false, message: "Action không hợp lệ" });
  } catch (e) {
    return NextResponse.json({ error: String(e), success: false }, { status: 500 });
  }
}
