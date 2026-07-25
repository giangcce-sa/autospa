import { prisma } from "@/lib/db";
import { generateContent, getBrandContext } from "@/lib/claude";
import { fetchFbConversations, replyToFbConversation } from "@/lib/facebook";
import { AccessError, accessErrorResponse, requirePageAccess, requireUser } from "@/lib/page-access";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const facebookPageId = searchParams.get("facebookPageId") || undefined;
    if (facebookPageId) await requirePageAccess(facebookPageId);
    else await requireUser({ owner: true });
    const messages = await prisma.inboxMessage.findMany({
      where: facebookPageId ? { facebookPageId } : {},
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const appointments = facebookPageId
      ? []
      : await prisma.appointmentRequest.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
    return NextResponse.json({ data: { messages, appointments }, success: true });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return NextResponse.json({ error: "Lỗi khi tải", success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireUser({ owner: true });
    const body = await req.json();
    const { action } = body;

    if (action === "auto-reply") {
      const { messageId, facebookPageId } = body;
      const storedMessage = await requireInboxMessage(messageId, facebookPageId);
      if (storedMessage.reply) {
        return NextResponse.json({ error: "Tin nhắn đã có reply được lưu", success: false }, { status: 409 });
      }
      const brandContext = await getBrandContext();
      const systemPrompt = `Bạn là nhân viên tư vấn của spa, trả lời tin nhắn khách hàng trên Facebook.
${brandContext ? `Thông tin spa:\n${brandContext}` : ""}
Quy tắc: Thân thiện, chuyên nghiệp, ngắn gọn. Nếu khách muốn đặt lịch, hỏi: tên, SĐT, dịch vụ, thời gian. Kết thúc bằng lời mời hành động. Viết tiếng Việt.`;
      const reply = await generateContent(`Khách nhắn: "${storedMessage.message}"\nTrả lời ngắn gọn:`, systemPrompt);
      await prisma.inboxMessage.update({ where: { id: storedMessage.id }, data: { reply, isAutoReply: true } });
      return NextResponse.json({ data: { reply }, success: true });
    }

    if (action === "simulate-message") {
      const { senderName, message, facebookPageId } = body;
      await requirePageAccess(facebookPageId, { owner: true });
      const msg = await prisma.inboxMessage.create({
        data: { senderId: `sim_${Date.now()}`, senderName: senderName ?? "Khách hàng", message, facebookPageId },
      });
      return NextResponse.json({ data: msg, success: true });
    }

    if (action === "save-appointment") {
      await requireUser({ owner: true });
      const { name, phone, service, preferredAt, note } = body;
      const appointment = await prisma.appointmentRequest.create({ data: { name, phone, service, preferredAt, note } });
      return NextResponse.json({ data: appointment, success: true });
    }

    if (action === "update-appointment") {
      await requireUser({ owner: true });
      const { id, status } = body;
      const appointment = await prisma.appointmentRequest.update({ where: { id }, data: { status } });
      return NextResponse.json({ data: appointment, success: true });
    }

    // Send AI reply via Facebook Messenger
    if (action === "send-fb-reply") {
      const { messageId, facebookPageId } = body;
      const msg = await requireInboxMessage(messageId, facebookPageId);
      if (!msg.reply || msg.senderId.startsWith("sim_")) {
        return NextResponse.json({ error: "Tin nhắn giả lập hoặc chưa có nội dung trả lời" }, { status: 400 });
      }
      const claimed = await prisma.inboxMessage.updateMany({
        where: { id: msg.id, isRead: false },
        data: { isRead: true },
      });
      if (!claimed.count) {
        return NextResponse.json({ error: "Reply đã được gửi hoặc đang được xử lý", success: false }, { status: 409 });
      }
      try {
        await replyToFbConversation(msg.senderId, msg.reply, msg.facebookPageId ?? undefined);
      } catch (error) {
        await prisma.inboxMessage.updateMany({ where: { id: msg.id, isRead: true }, data: { isRead: false } });
        throw error;
      }
      return NextResponse.json({ success: true });
    }

    // Sync real inbox messages from Facebook
    if (action === "sync-fb") {
      const { facebookPageId } = body;
      if (facebookPageId) await requirePageAccess(facebookPageId, { owner: true });
      const pagesToSync = facebookPageId
        ? await prisma.facebookPage.findMany({ where: { id: facebookPageId } })
        : await prisma.facebookPage.findMany({ where: { isActive: true } });

      if (!pagesToSync.length) return NextResponse.json({ error: "Chưa cấu hình Facebook Page", success: false }, { status: 400 });

      let newCount = 0;
      let total = 0;
      for (const page of pagesToSync) {
        let conversations;
        try {
          conversations = await fetchFbConversations(body.limit ?? 20, page.id);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return NextResponse.json({ error: msg, success: false }, { status: 400 });
        }
        total += conversations.length;

        for (const conv of conversations) {
          const exists = await prisma.inboxMessage.findFirst({
            where: { senderId: conv.senderId, message: conv.message, facebookPageId: page.id },
          });
          if (exists) continue;

          await prisma.inboxMessage.create({
            data: {
              senderId: conv.senderId,
              senderName: conv.senderName,
              message: conv.message,
              facebookPageId: page.id,
              createdAt: new Date(conv.createdTime),
            },
          });
          newCount++;
        }
      }

      return NextResponse.json({ data: { newCount, total }, success: true });
    }

    return NextResponse.json({ error: "Action không hợp lệ", success: false }, { status: 400 });
  } catch (err) {
    const access = accessErrorResponse(err);
    if (access) return access;
    const msg = err instanceof Error ? err.message : "Lỗi không xác định";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}

async function requireInboxMessage(messageId: string | undefined, facebookPageId: string | undefined) {
  if (!messageId) throw new AccessError("Thiếu messageId", 400);
  if (!facebookPageId) throw new AccessError("Hãy chọn Facebook Page", 400);
  const message = await prisma.inboxMessage.findUnique({ where: { id: messageId } });
  if (!message) throw new AccessError("Không tìm thấy tin nhắn", 404);
  if (message.facebookPageId !== facebookPageId) throw new AccessError("Tin nhắn thuộc Facebook Page khác", 403);
  await requirePageAccess(facebookPageId, { owner: true });
  return message;
}
