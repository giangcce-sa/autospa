import { prisma } from "@/lib/db";
import { accessErrorResponse, requireUser } from "@/lib/page-access";
import { routeErrorResponse } from "@/lib/api-response";
import { runRealtimeMonitor } from "@/lib/realtime-monitor";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    await requireUser({ owner: true });
    const alerts = await prisma.realtimeAlert.findMany({
      orderBy: { detectedAt: "desc" },
      take: 30,
    });
    const unack = await prisma.realtimeAlert.count({ where: { acknowledged: false } });
    return NextResponse.json({ data: { alerts, unack }, success: true });
  } catch (err) {
    const access = accessErrorResponse(err);
    if (access) return access;
    return routeErrorResponse(err, "Lỗi");
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireUser({ owner: true });
    const body = await req.json() as { action?: unknown; id?: unknown };
    const action = typeof body.action === "string" ? body.action : null;
    const id = typeof body.id === "string" ? body.id.trim() : null;

    if (action === "run-now") {
      const result = await runRealtimeMonitor();
      return NextResponse.json({ data: result, success: true });
    }

    if (action === "acknowledge") {
      if (!id || id.length > 200) return NextResponse.json({ error: "Alert id không hợp lệ", success: false }, { status: 400 });
      const updated = await prisma.realtimeAlert.updateMany({ where: { id }, data: { acknowledged: true } });
      if (updated.count === 0) return NextResponse.json({ error: "Không tìm thấy alert", success: false }, { status: 404 });
      return NextResponse.json({ success: true });
    }

    if (action === "acknowledge-all") {
      await prisma.realtimeAlert.updateMany({ where: { acknowledged: false }, data: { acknowledged: true } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Action không hợp lệ", success: false }, { status: 400 });
  } catch (err) {
    const access = accessErrorResponse(err);
    if (access) return access;
    return routeErrorResponse(err, "Lỗi");
  }
}
