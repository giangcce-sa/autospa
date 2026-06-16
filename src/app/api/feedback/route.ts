import { prisma } from "@/lib/db";
import { batchSendNps, recordNpsScore, sendNpsSurvey } from "@/lib/feedback";
import { NextRequest, NextResponse } from "next/server";

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
      const result = await sendNpsSurvey(customerId, channel);
      if (!result.ok) return NextResponse.json({ error: result.error, success: false }, { status: result.status });
      return NextResponse.json({ data: { platform: result.platform }, success: true });
    }

    // Record NPS score (from webhook or manual)
    if (action === "record") {
      const { customerId, score } = body as { customerId: string; score: number };
      const result = await recordNpsScore(customerId, score);
      if (!result.ok) return NextResponse.json({ error: result.error, success: false }, { status: result.status });
      return NextResponse.json({ success: true });
    }

    // Batch send — trigger NPS for customers with recent appointments
    if (action === "batch-send") {
      const { hoursAfter = 2 } = body as { hoursAfter?: number };
      return NextResponse.json({ data: await batchSendNps(hoursAfter), success: true });
    }

    return NextResponse.json({ error: "Action không hợp lệ", success: false }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi không xác định";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}
