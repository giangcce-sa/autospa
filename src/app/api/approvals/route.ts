import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveApproval, checkApproval } from "@/lib/approval-gate";

export async function GET() {
  try {
    const approvals = await prisma.pendingApproval.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "desc" },
    });
    // Auto-expire timed-out ones
    const now = new Date();
    const timedOut = approvals.filter((a) => a.timeoutAt < now);
    for (const a of timedOut) {
      await prisma.pendingApproval.update({ where: { id: a.id }, data: { status: "timed_out" } });
    }
    const active = approvals.filter((a) => a.timeoutAt >= now);
    return NextResponse.json({ data: active, success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e), success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { id, decision } = await req.json();
    if (!id || !["approved", "rejected"].includes(decision)) {
      return NextResponse.json({ error: "Thiếu id hoặc decision không hợp lệ", success: false }, { status: 400 });
    }
    const status = await checkApproval(id);
    if (status !== "pending") {
      return NextResponse.json({ error: `Approval đã ${status}`, success: false }, { status: 400 });
    }
    await resolveApproval(id, decision);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e), success: false }, { status: 500 });
  }
}
