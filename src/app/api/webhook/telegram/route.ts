import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { executeApproval } from "@/lib/approval-executor";
import { answerCallbackQuery, editMessage, sendMessage } from "@/lib/telegram";
import { isTelegramActorAllowed } from "@/lib/telegram-control";

type TelegramUpdate = {
  update_id: number;
  message?: {
    text?: string;
    chat?: { id?: number };
    from?: { id?: number };
  };
  callback_query?: {
    id?: string;
    data?: string;
    from?: { id?: number };
    message?: { message_id?: number; chat?: { id?: number } };
  };
};

function secureEqual(received: string, expected: string) {
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function commandReply(command: string) {
  if (command === "/help" || command === "/start") {
    return [
      "*AutoSpa Control Center*",
      "/status - Tình trạng hệ thống",
      "/report - Báo cáo kinh doanh nhanh",
      "/ads - Tình trạng quảng cáo",
      "/approvals - Yêu cầu đang chờ",
      "/pause - Chuyển hệ thống về chế độ giám sát",
      "/help - Danh sách lệnh",
    ].join("\n");
  }

  if (command === "/status") {
    const [settings, failedJobs, pendingApprovals] = await Promise.all([
      prisma.settings.findFirst({ select: { automationLevel: true } }),
      prisma.jobRun.count({ where: { status: "failed", startedAt: { gte: new Date(Date.now() - 86_400_000) } } }),
      prisma.pendingApproval.count({ where: { status: "pending", timeoutAt: { gt: new Date() } } }),
    ]);
    return `*Trạng thái AutoSpa*\nChế độ: ${settings?.automationLevel ?? "chưa cấu hình"}\nApproval chờ: ${pendingApprovals}\nJob lỗi 24h: ${failedJobs}`;
  }

  if (command === "/report") {
    const { generateWeeklyReport } = await import("@/lib/weekly-report");
    return generateWeeklyReport();
  }

  if (command === "/ads") {
    const [settings, lastJob, actions] = await Promise.all([
      prisma.settings.findFirst({
        select: { automationLevel: true, adsOptimizePauseCtr: true, adsOptimizeScaleCtr: true, adsOptimizeMinRoas: true },
      }),
      prisma.jobRun.findFirst({ where: { name: "ads_optimize" }, orderBy: { startedAt: "desc" } }),
      prisma.adOptimizationLog.count({ where: { createdAt: { gte: new Date(Date.now() - 86_400_000) } } }),
    ]);
    return `*Ads Automation*\nChế độ: ${settings?.automationLevel ?? "chưa cấu hình"}\nPause CTR: ${settings?.adsOptimizePauseCtr ?? "-"}%\nScale CTR: ${settings?.adsOptimizeScaleCtr ?? "-"}%\nROAS tối thiểu: ${settings?.adsOptimizeMinRoas ?? "-"}\nHành động 24h: ${actions}\nJob cuối: ${lastJob?.status ?? "chưa chạy"}`;
  }

  if (command === "/approvals") {
    const approvals = await prisma.pendingApproval.findMany({
      where: { status: "pending", timeoutAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    if (!approvals.length) return "Không có yêu cầu nào đang chờ duyệt.";
    return `*Approval đang chờ*\n${approvals.map((item, index) => `${index + 1}. ${item.type} - ${item.shortCode}`).join("\n")}`;
  }

  if (command === "/pause") {
    await prisma.settings.upsert({
      where: { id: "1" },
      update: { automationLevel: "supervised" },
      create: { id: "1", automationLevel: "supervised" },
    });
    return "Đã chuyển AutoSpa về chế độ giám sát. Hành động tự động sẽ chỉ tạo đề xuất.";
  }

  return "Lệnh không hợp lệ. Dùng /help để xem danh sách lệnh.";
}

export async function POST(req: NextRequest) {
  const settings = await prisma.settings.findFirst({
    select: { telegramWebhookSecret: true, telegramChatId: true, telegramAdminUserId: true },
  });
  if (!settings?.telegramWebhookSecret || !settings.telegramChatId) {
    return NextResponse.json({ error: "Telegram webhook chưa cấu hình" }, { status: 503 });
  }
  const receivedSecret = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!secureEqual(receivedSecret, settings.telegramWebhookSecret)) {
    return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401 });
  }

  const update = await req.json() as TelegramUpdate;
  const callbackChatId = update.callback_query?.message?.chat?.id;
  const messageChatId = update.message?.chat?.id;
  const chatId = String(callbackChatId ?? messageChatId ?? "");
  const senderId = String(update.callback_query?.from?.id ?? update.message?.from?.id ?? "");
  if (!update.update_id || !isTelegramActorAllowed({
    configuredChatId: settings.telegramChatId,
    configuredAdminUserId: settings.telegramAdminUserId,
    chatId,
    senderId,
  })) {
    return NextResponse.json({ ok: true });
  }

  const duplicate = await prisma.telegramUpdate.findUnique({ where: { updateId: String(update.update_id) } });
  if (duplicate) return NextResponse.json({ ok: true, duplicate: true });
  await prisma.telegramUpdate.create({
    data: {
      updateId: String(update.update_id),
      kind: update.callback_query ? "callback_query" : "message",
      chatId,
    },
  });

  if (update.callback_query?.data?.startsWith("approval:")) {
    const [, rawDecision, approvalId] = update.callback_query.data.split(":");
    const decision = rawDecision === "Y" ? "approved" : "rejected";
    try {
      const result = await executeApproval(approvalId, decision);
      const statusText = result.status === "executed"
        ? "Đã duyệt và thực thi thành công."
        : result.status === "approved"
          ? "Đã duyệt."
          : "Đã từ chối.";
      if (update.callback_query.id) await answerCallbackQuery(update.callback_query.id, statusText);
      const messageId = update.callback_query.message?.message_id;
      if (messageId) await editMessage(chatId, messageId, `*AutoSpa Approval*\n\n${statusText}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (update.callback_query.id) await answerCallbackQuery(update.callback_query.id, `Lỗi: ${message}`);
    }
    return NextResponse.json({ ok: true });
  }

  const text = update.message?.text?.trim();
  if (text?.startsWith("/")) {
    const command = text.split(/\s+/)[0].split("@")[0].toLowerCase();
    const reply = await commandReply(command);
    await sendMessage(reply, "Markdown", { type: "command_reply", chatId });
  }

  return NextResponse.json({ ok: true });
}
