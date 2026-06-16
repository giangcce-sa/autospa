import { prisma } from "@/lib/db";
import { postToZalo } from "@/lib/zalo";
import { replyToFbConversation } from "@/lib/facebook";
import { NextRequest, NextResponse } from "next/server";

const NPS_MESSAGE =
  "Cảm ơn bạn đã trải nghiệm dịch vụ của chúng tôi! " +
  "Bạn hài lòng với trải nghiệm hôm nay không? Hãy cho chúng tôi biết bằng cách trả lời từ 1-5 ⭐\n" +
  "(1 = Chưa hài lòng, 5 = Rất hài lòng)";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get("page") ?? 1);
    const take = 20;

    const [total, customers] = await Promise.all([
      prisma.customer.count({ where: { npsScore: { not: null } } }),
      prisma.customer.findMany({
        where: { npsScore: { not: null } },
        orderBy: { npsAt: "desc" },
        select: { id: true, name: true, phone: true, npsScore: true, npsAt: true, segment: true },
        take,
        skip: (page - 1) * take,
      }),
    ]);

    const avg =
      customers.length > 0
        ? Math.round((customers.reduce((s, c) => s + (c.npsScore ?? 0), 0) / customers.length) * 10) / 10
        : null;

    return NextResponse.json({ data: { customers, total, avg }, success: true });
  } catch {
    return NextResponse.json({ error: "Lỗi khi tải", success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // Send NPS survey message to a customer
    if (action === "send") {
      const { customerId, channel } = body as { customerId: string; channel?: "zalo" | "facebook" };
      const customer = await prisma.customer.findUnique({ where: { id: customerId } });
      if (!customer) return NextResponse.json({ error: "Không tìm thấy khách hàng", success: false }, { status: 404 });

      const platform = channel ?? (customer.fbId ? "facebook" : "zalo");

      if (platform === "zalo" && customer.phone) {
        await postToZalo(NPS_MESSAGE, undefined, customer.phone);
      } else if (platform === "facebook" && customer.fbId) {
        await replyToFbConversation(customer.fbId, NPS_MESSAGE);
      } else {
        return NextResponse.json({ error: "Không có thông tin liên lạc (phone/fbId) để gửi NPS", success: false }, { status: 400 });
      }

      // Log as CareMessage
      await prisma.careMessage.create({
        data: {
          customerId,
          type: "nps_survey",
          content: NPS_MESSAGE,
          platform,
          sentAt: new Date(),
          status: "sent",
        },
      });

      return NextResponse.json({ success: true });
    }

    // Record NPS score (from webhook or manual)
    if (action === "record") {
      const { customerId, score } = body as { customerId: string; score: number };
      if (!customerId || score < 1 || score > 5) {
        return NextResponse.json({ error: "customerId và score (1-5) là bắt buộc", success: false }, { status: 400 });
      }
      await prisma.customer.update({
        where: { id: customerId },
        data: { npsScore: score, npsAt: new Date() },
      });
      // Also save as CustomerNote
      await prisma.customerNote.create({
        data: { customerId, content: `NPS: ${score}/5`, type: "nps" },
      });
      return NextResponse.json({ success: true });
    }

    // Batch send — trigger NPS for customers with recent appointments
    if (action === "batch-send") {
      const { hoursAfter = 2 } = body as { hoursAfter?: number };
      const since = new Date(Date.now() - hoursAfter * 3600000);

      // Find customers who had appointments completed recently and haven't received NPS yet today
      const recentCare = await prisma.careMessage.findMany({
        where: { type: "nps_survey", sentAt: { gte: new Date(Date.now() - 86400000) } },
        select: { customerId: true },
      });
      const alreadySent = new Set(recentCare.map((c) => c.customerId).filter(Boolean) as string[]);

      const appointments = await prisma.appointmentRequest.findMany({
        where: { status: "confirmed", updatedAt: { gte: since }, customerId: { not: null } },
        include: { customer: true },
      });

      let sent = 0;
      for (const appt of appointments) {
        if (!appt.customerId || alreadySent.has(appt.customerId)) continue;
        const customer = appt.customer;
        if (!customer) continue;
        const platform = customer.fbId ? "facebook" : customer.phone ? "zalo" : null;
        if (!platform) continue;
        try {
          if (platform === "zalo" && customer.phone) await postToZalo(NPS_MESSAGE, undefined, customer.phone);
          else if (platform === "facebook" && customer.fbId) await replyToFbConversation(customer.fbId, NPS_MESSAGE);
          await prisma.careMessage.create({
            data: { customerId: appt.customerId, type: "nps_survey", content: NPS_MESSAGE, platform, sentAt: new Date(), status: "sent" },
          });
          sent++;
        } catch { /* skip individual failures */ }
      }

      return NextResponse.json({ data: { sent }, success: true });
    }

    return NextResponse.json({ error: "Action không hợp lệ", success: false }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi không xác định";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}
