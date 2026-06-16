import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, id, status, notes } = body;

    if (action === "override-outcome") {
      if (!id || !status) {
        return NextResponse.json({ error: "Thiếu id hoặc status", success: false }, { status: 400 });
      }
      if (!["success", "fail", "neutral"].includes(status)) {
        return NextResponse.json({ error: "Status không hợp lệ", success: false }, { status: 400 });
      }

      const existing = await prisma.cEODecision.findUnique({ where: { id } });
      if (!existing) return NextResponse.json({ error: "Not found", success: false }, { status: 404 });

      const prevNotes = existing.outcomeNotes ?? "";
      const overrideNote = `[Admin override ${new Date().toLocaleDateString("vi-VN")}]: ${notes ?? "(không có lý do)"}`;
      const newNotes = prevNotes
        ? `${prevNotes}\n\n${overrideNote}`
        : overrideNote;

      const updated = await prisma.cEODecision.update({
        where: { id },
        data: {
          outcomeStatus: status,
          outcomeNotes: newNotes,
        },
      });
      return NextResponse.json({ data: updated, success: true });
    }

    return NextResponse.json({ error: "Action không hợp lệ", success: false }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const decisions = await prisma.cEODecision.findMany({
      where: status ? { outcomeStatus: status } : undefined,
      orderBy: { date: "desc" },
      take: 50,
    });

    const counts = {
      total: await prisma.cEODecision.count(),
      success: await prisma.cEODecision.count({ where: { outcomeStatus: "success" } }),
      fail: await prisma.cEODecision.count({ where: { outcomeStatus: "fail" } }),
      pending: await prisma.cEODecision.count({ where: { outcomeStatus: "pending" } }),
    };

    return NextResponse.json({ data: { decisions, counts }, success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}
