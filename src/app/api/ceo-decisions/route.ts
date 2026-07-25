import { isOutcomeStatus, isOverridableOutcomeStatus } from "@/lib/ai-runtime-types";
import { prisma } from "@/lib/db";
import { accessErrorResponse, requireUser } from "@/lib/page-access";
import { businessDateKey } from "@/lib/today-policy";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    await requireUser({ owner: true });
    const body = await req.json() as { action?: unknown; id?: unknown; status?: unknown; notes?: unknown };
    if (body.action !== "override-outcome") {
      return NextResponse.json({ error: "Action không hợp lệ", success: false }, { status: 400 });
    }

    const id = typeof body.id === "string" ? body.id.trim() : "";
    const status = isOverridableOutcomeStatus(body.status) ? body.status : null;
    const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : "";
    if (!id || !status || !notes) {
      return NextResponse.json({ error: "Cần id, outcome và lý do override", success: false }, { status: 400 });
    }

    const existing = await prisma.cEODecision.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Không tìm thấy quyết định", success: false }, { status: 404 });

    const overrideNote = `[Owner override ${businessDateKey()}]: ${notes}`;
    const updated = await prisma.cEODecision.update({
      where: { id },
      data: {
        outcomeStatus: status,
        outcomeNotes: existing.outcomeNotes ? `${existing.outcomeNotes}\n\n${overrideNote}` : overrideNote,
      },
    });
    return NextResponse.json({ data: updated, success: true });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return NextResponse.json({ error: "Không thể cập nhật outcome", success: false }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const requestedStatus = new URL(req.url).searchParams.get("status");
    const status = isOutcomeStatus(requestedStatus) ? requestedStatus : null;
    if (requestedStatus && !status) {
      return NextResponse.json({ error: "Status không hợp lệ", success: false }, { status: 400 });
    }

    const [decisions, total, success, fail, pending] = await Promise.all([
      prisma.cEODecision.findMany({
        where: status ? { outcomeStatus: status } : undefined,
        orderBy: { date: "desc" },
        take: 50,
      }),
      prisma.cEODecision.count(),
      prisma.cEODecision.count({ where: { outcomeStatus: "success" } }),
      prisma.cEODecision.count({ where: { outcomeStatus: "fail" } }),
      prisma.cEODecision.count({ where: { outcomeStatus: "pending" } }),
    ]);

    return NextResponse.json({ data: { decisions, counts: { total, success, fail, pending } }, success: true });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return NextResponse.json({ error: "Không thể đọc bộ nhớ quyết định", success: false }, { status: 500 });
  }
}
