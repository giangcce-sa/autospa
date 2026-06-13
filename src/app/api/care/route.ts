import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateContent } from "@/lib/claude";

export async function GET() {
  try {
    const messages = await prisma.careMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { customer: { select: { name: true, phone: true } } },
    });
    const stats = {
      pending: await prisma.careMessage.count({ where: { status: "pending" } }),
      sent: await prisma.careMessage.count({ where: { status: "sent" } }),
      total: await prisma.careMessage.count(),
    };
    const customers = await prisma.customer.findMany({ select: { id: true, name: true, phone: true, birthday: true, segment: true }, orderBy: { name: "asc" } });
    return NextResponse.json({ data: { messages, stats, customers } });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "generate") {
      const { type, customerId, customerName, service, birthday } = body;
      const promptMap: Record<string, string> = {
        birthday: `Khách hàng tên ${customerName} có sinh nhật${birthday ? ` ngày ${birthday}` : ""}. Viết tin nhắn chúc mừng sinh nhật và tặng ưu đãi đặc biệt từ spa. Ngắn gọn, thân thiện, dưới 100 chữ.`,
        appointment: `Khách hàng tên ${customerName} có lịch hẹn dịch vụ${service ? ` "${service}"` : ""}. Viết tin nhắn nhắc lịch thân thiện, chuyên nghiệp. Dưới 80 chữ.`,
        followup: `Khách hàng tên ${customerName} vừa sử dụng dịch vụ${service ? ` "${service}"` : ""} tại spa. Viết tin nhắn hỏi thăm kết quả, chăm sóc sau liệu trình. Dưới 100 chữ.`,
        promo: `Viết tin nhắn giới thiệu chương trình khuyến mãi đặc biệt của spa đến khách hàng tên ${customerName}. Hấp dẫn, có kêu gọi hành động. Dưới 100 chữ.`,
      };
      const content = await generateContent(promptMap[type] || promptMap.promo, "Bạn là nhân viên chăm sóc khách hàng spa, viết tin nhắn thân thiện, gần gũi bằng tiếng Việt.");
      const msg = await prisma.careMessage.create({ data: { customerId: customerId || null, type, content, status: "pending" } });
      return NextResponse.json({ data: { ...msg, content } });
    }

    if (action === "mark-sent") {
      await prisma.careMessage.update({ where: { id: body.id }, data: { status: "sent", sentAt: new Date() } });
      return NextResponse.json({ success: true });
    }

    if (action === "bulk-birthday") {
      const today = new Date();
      const monthDay = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}`;
      const customers = await prisma.customer.findMany({ where: { birthday: { contains: monthDay } } });
      const created = [];
      for (const c of customers) {
        const content = await generateContent(
          `Khách hàng tên ${c.name} có sinh nhật hôm nay. Viết tin nhắn chúc mừng sinh nhật từ spa, tặng ưu đãi 20% dịch vụ. Dưới 80 chữ.`,
          "Bạn là nhân viên chăm sóc khách hàng spa."
        );
        const msg = await prisma.careMessage.create({ data: { customerId: c.id, type: "birthday", content, status: "pending" } });
        created.push(msg);
      }
      return NextResponse.json({ data: { count: created.length, messages: created } });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
