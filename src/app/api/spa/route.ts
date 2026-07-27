import { createHash, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logActivity } from "@/lib/activity-log";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/page-access";
import { routeErrorResponse } from "@/lib/api-response";
import { decryptSecret } from "@/lib/secrets-crypto";
import { pullSpaRevenue, pushLeadToSpa, testSpaConnection } from "@/lib/spa-client";

const operationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("test-connection") }),
  z.object({ action: z.literal("pull-revenue") }),
  z.object({ action: z.literal("push-lead"), leadId: z.string().trim().min(1) }),
]);

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

async function verifySpaWebhook(req: NextRequest) {
  const settings = await prisma.settings.findFirst({ select: { spaWebhookSecret: true } });
  const configuredSecret = decryptSecret(settings?.spaWebhookSecret)?.trim();
  if (!configuredSecret) {
    return NextResponse.json({ error: "Spa webhook secret chưa được cấu hình", success: false }, { status: 403 });
  }

  const provided =
    req.headers.get("x-spa-webhook-secret")
    ?? req.headers.get("x-webhook-secret")
    ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
    ?? "";

  if (!timingSafeEqual(digest(provided), digest(configuredSecret))) {
    return NextResponse.json({ error: "Forbidden", success: false }, { status: 403 });
  }

  return null;
}

export async function GET() {
  try {
    await requireUser();
    const [sync, settings] = await Promise.all([
      prisma.spaSync.findUnique({ where: { id: "1" } }),
      prisma.settings.findFirst({ select: { spaApiUrl: true } }),
    ]);

    return NextResponse.json({
      data: {
        sync,
        readiness: {
          configured: Boolean(settings?.spaApiUrl?.trim()),
          source: "SpaSync",
        },
      },
      success: true,
    });
  } catch (error) {
    return routeErrorResponse(error, "Không thể tải trạng thái Spa");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "";

    if (action === "webhook" || typeof body.type === "string") {
      const denied = await verifySpaWebhook(req);
      if (denied) return denied;

      const type = String(body.type ?? action);
      if (type === "booking_confirmed") {
        const phone = typeof body.phone === "string" ? body.phone : undefined;
        const lead = phone ? await prisma.lead.findFirst({ where: { phone } }) : null;
        if (lead) {
          await prisma.lead.update({
            where: { id: lead.id },
            data: { stage: "closed", lastAction: "Spa xác nhận lịch hẹn" },
          });
        }
      }

      if (type === "payment_received") {
        const bookingId = typeof body.bookingId === "string" ? body.bookingId.trim() : "";
        const lead = bookingId ? await prisma.lead.findFirst({ where: { spaBookingId: bookingId } }) : null;
        if (lead) {
          await prisma.lead.update({
            where: { id: lead.id },
            data: { stage: "closed", lastAction: "Đã thanh toán" },
          });
        }

        const amount = Number(body.amount ?? 0);
        if (Number.isFinite(amount) && amount > 0 && bookingId) {
          let created = false;
          try {
            await prisma.bookingRevenue.create({
              data: {
                bookingId,
                leadId: lead?.id ?? null,
                customerId: lead?.customerId ?? null,
                service: typeof body.service === "string" ? body.service : lead?.service ?? null,
                amount: Math.round(amount),
                paidAt: typeof body.paidAt === "string" || typeof body.paidAt === "number"
                  ? new Date(body.paidAt)
                  : new Date(),
                fromPostId: lead?.fromPostId ?? null,
                fromCampaignId: lead?.fromCampaignId ?? null,
                fromAdId: lead?.fromAdId ?? null,
              },
            });
            created = true;
          } catch (error) {
            if (!isUniqueConstraintError(error)) throw error;
          }

          if (created) {
            await logActivity({
              type: "revenue",
              title: `+${Math.round(amount).toLocaleString("vi-VN")}đ doanh thu`,
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

    await requireUser({ owner: true });
    const operation = operationSchema.parse(body);

    if (operation.action === "test-connection") {
      return NextResponse.json({ data: await testSpaConnection(), success: true });
    }

    if (operation.action === "pull-revenue") {
      return NextResponse.json({ data: await pullSpaRevenue(), success: true });
    }

    const lead = await prisma.lead.findUnique({ where: { id: operation.leadId } });
    if (!lead) {
      return NextResponse.json({ error: "Không tìm thấy lead", success: false }, { status: 404 });
    }

    const result = await pushLeadToSpa({
      name: lead.name,
      phone: lead.phone,
      service: lead.service,
      source: lead.source,
      note: lead.note,
    });
    if (result.bookingId) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { spaBookingId: result.bookingId, handoffAt: new Date(), handoffMode: "api" },
      });
    }

    return NextResponse.json({ data: result, success: true });
  } catch (error) {
    return routeErrorResponse(error, "Lỗi không xác định");
  }
}
