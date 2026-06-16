import { prisma } from "@/lib/db";
import { runRealtimeMonitor } from "@/lib/realtime-monitor";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    const alerts = await prisma.realtimeAlert.findMany({
      orderBy: { detectedAt: "desc" },
      take: 30,
    });
    const unack = await prisma.realtimeAlert.count({ where: { acknowledged: false } });
    return NextResponse.json({ data: { alerts, unack }, success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, id } = body;

    if (action === "run-now") {
      const result = await runRealtimeMonitor();
      return NextResponse.json({ data: result, success: true });
    }

    if (action === "acknowledge" && id) {
      await prisma.realtimeAlert.update({ where: { id }, data: { acknowledged: true } });
      return NextResponse.json({ success: true });
    }

    if (action === "acknowledge-all") {
      await prisma.realtimeAlert.updateMany({ where: { acknowledged: false }, data: { acknowledged: true } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Action không hợp lệ", success: false }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}
