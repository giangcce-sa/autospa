import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { pushLeadToSpa, pullSpaRevenue, testSpaConnection } from "@/lib/spa-client";
import { logActivity } from "@/lib/activity-log";

async function requireAdminSession() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
  }
  return null;
}

async function verifySpaWebhook(req: NextRequest) {
  const settings = await prisma.settings.findFirst({ select: { spaWebhookSecret: true } });
  const configuredSecret = settings?.spaWebhookSecret?.trim();
  if (!configuredSecret) {
    return NextResponse.json({ error: "Spa webhook secret chưa được cấu hình", success: false }, { status: 403 });
  }

  const provided =
    req.headers.get("x-spa-webhook-secret") ??
    req.headers.get("x-webhook-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (provided !== configuredSecret) {
    return NextResponse.json({ error: "Forbidden", success: false }, { status: 403 });
  }

  return null;
}

export async function GET(req: NextRequest) {
  const denied = await requireAdminSession();
  if (denied) return denied;

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
      const denied = await requireAdminSession();
      if (denied) return denied;

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
      const denied = await verifySpaWebhook(req);
      if (denied) return denied;

      const type = String(body.type ?? action);
      if (type === "booking_confirmed") {
        const phone = typeof body.phone === "string" ? body.phone : undefined;
        const lead = phone ? await prisma.lead.findFirst({ where: { phone } }) : null;
        if (lead) {
          await prisma.lead.update({ where: { id: lead.id }, data: { stage: "closed", lastAction: "Spa xác nhận lịch hẹn" } });
        }
      }
      if (type === "payment_received") {
        const bookingId = typeof body.bookingId === "string" ? body.bookingId : undefined;
        const lead = bookingId ? await prisma.lead.findFirst({ where: { spaBookingId: bookingId } }) : null;
        if (lead) {
          await prisma.lead.update({ where: { id: lead.id }, data: { stage: "closed", lastAction: "Đã thanh toán" } });
        }
        // Record revenue with attribution if amount provided
        const amount = Number(body.amount ?? 0);
        if (amount > 0 && bookingId) {
          const existing = await prisma.bookingRevenue.findUnique({ where: { bookingId } });
          if (!existing) {
            await prisma.bookingRevenue.create({
              data: {
                bookingId,
                leadId: lead?.id ?? null,
                customerId: lead?.customerId ?? null,
                service: typeof body.service === "string" ? body.service : lead?.service ?? null,
                amount,
                paidAt: typeof body.paidAt === "string" || typeof body.paidAt === "number" ? new Date(body.paidAt) : new Date(),
                fromPostId: lead?.fromPostId ?? null,
                fromCampaignId: lead?.fromCampaignId ?? null,
                fromAdId: lead?.fromAdId ?? null,
              },
            });
            await logActivity({
              type: "revenue",
              title: `+${amount.toLocaleString("vi-VN")}đ doanh thu`,
              detail: typeof body.service === "string" ? body.service : lead?.service ?? undefined,
              href: "/reports",
              severity: "success",
              source: "spa_webhook",
              metadata: { bookingId, leadId: lead?.id },
            }).catch(() => null);
          }
        }
      }
      return NextResponse.json({ received: true });
    }

    return NextResponse.json({ error: "Action không hợp lệ", success: false }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e).replace("Error: ", ""), success: false }, { status: 500 });
  }
}
