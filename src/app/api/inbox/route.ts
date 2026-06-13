import { prisma } from "@/lib/db";
import { generateContent, getBrandContext } from "@/lib/claude";
import { fetchFbConversations, replyToFbConversation } from "@/lib/facebook";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const facebookPageId = searchParams.get("facebookPageId") || undefined;
    const where = facebookPageId ? { facebookPageId } : {};
    const [messages, appointments] = await Promise.all([
      prisma.inboxMessage.findMany({ where, orderBy: { createdAt: "desc" }, take: 50 }),
      prisma.appointmentRequest.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    ]);
    return NextResponse.json({ data: { messages, appointments }, success: true });
  } catch {
    return NextResponse.json({ error: "Lỗi khi tải", success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "auto-reply") {
      const { messageId, senderName, message } = body;
      const brandContext = await getBrandContext();
      const systemPrompt = `Bạn là nhân viên tư vấn của spa, trả lời tin nhắn khách hàng trên Facebook.
${brandContext ? `Thông tin spa:\n${brandContext}` : ""}
Quy tắc: Thân thiện, chuyên nghiệp, ngắn gọn. Nếu khách muốn đặt lịch, hỏi: tên, SĐT, dịch vụ, thời gian. Kết thúc bằng lời mời hành động. Viết tiếng Việt.`;
      const reply = await generateContent(`Khách nhắn: "${message}"\nTrả lời ngắn gọn:`, systemPrompt);
      await prisma.inboxMessage.update({ where: { id: messageId }, data: { reply, isAutoReply: true } });
      return NextResponse.json({ data: { reply }, success: true });
    }

    if (action === "simulate-message") {
      const { senderName, message } = body;
      const msg = await prisma.inboxMessage.create({
        data: { senderId: `sim_${Date.now()}`, senderName: senderName ?? "Khách hàng", message },
      });
      return NextResponse.json({ data: msg, success: true });
    }

    if (action === "save-appointment") {
      const { name, phone, service, preferredAt, note } = body;
      const appointment = await prisma.appointmentRequest.create({ data: { name, phone, service, preferredAt, note } });
      return NextResponse.json({ data: appointment, success: true });
    }

    if (action === "update-appointment") {
      const { id, status } = body;
      const appointment = await prisma.appointmentRequest.update({ where: { id }, data: { status } });
      return NextResponse.json({ data: appointment, success: true });
    }

    // Send AI reply via Facebook Messenger
    if (action === "send-fb-reply") {
      const { messageId } = body;
      const msg = await prisma.inboxMessage.findUnique({ where: { id: messageId } });
      if (!msg?.reply || msg.senderId.startsWith("sim_")) {
        return NextResponse.json({ error: "Tin nhắn giả lập hoặc chưa có nội dung trả lời" }, { status: 400 });
      }
      await replyToFbConversation(msg.senderId, msg.reply, msg.facebookPageId ?? undefined);
      await prisma.inboxMessage.update({ where: { id: messageId }, data: { isRead: true } });
      return NextResponse.json({ success: true });
    }

    // Sync real inbox messages from Facebook
    if (action === "sync-fb") {
      const { facebookPageId } = body;
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
            where: { senderId: conv.senderId, message: conv.message },
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
    const msg = err instanceof Error ? err.message : "Lỗi không xác định";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}
