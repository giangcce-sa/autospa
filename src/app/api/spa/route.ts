import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { pushLeadToSpa, pullSpaRevenue, testSpaConnection } from "@/lib/spa-client";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") ?? "pull-revenue";
  try {
    if (action === "test") {
      const result = await testSpaConnection();
      return NextResponse.json(result);
    }
    if (action === "pull-revenue") {
      const data = await pullSpaRevenue();
      return NextResponse.json({ data, success: true });
    }
    return NextResponse.json({ error: "Action không hợp lệ", success: false }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e).replace("Error: ", ""), success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "push-lead") {
      const lead = await prisma.lead.findUnique({ where: { id: body.leadId } });
      if (!lead) return NextResponse.json({ error: "Không tìm thấy lead", success: false }, { status: 404 });
      const result = await pushLeadToSpa({ name: lead.name, phone: lead.phone, service: lead.service, source: lead.source, note: lead.note });
      if (result.bookingId) {
        await prisma.lead.update({ where: { id: lead.id }, data: { spaBookingId: result.bookingId, handoffAt: new Date(), handoffMode: "api" } });
      }
      return NextResponse.json({ data: result, success: true });
    }

    // Inbound webhook from spa software
    if (action === "webhook" || body.type) {
      const type = body.type ?? action;
      if (type === "booking_confirmed") {
        const lead = await prisma.lead.findFirst({ where: { phone: body.phone } });
        if (lead) {
          await prisma.lead.update({ where: { id: lead.id }, data: { stage: "closed", lastAction: "Spa xác nhận lịch hẹn" } });
        }
      }
      if (type === "payment_received") {
        const lead = await prisma.lead.findFirst({ where: { spaBookingId: body.bookingId } });
        if (lead) {
          await prisma.lead.update({ where: { id: lead.id }, data: { stage: "closed", lastAction: "Đã thanh toán" } });
        }
      }
      return NextResponse.json({ received: true });
    }

    return NextResponse.json({ error: "Action không hợp lệ", success: false }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e).replace("Error: ", ""), success: false }, { status: 500 });
  }
}
