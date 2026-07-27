import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkApproval } from "@/lib/approval-gate";
import { executeApproval } from "@/lib/approval-executor";
import { requireUser } from "@/lib/page-access";
import { routeErrorResponse } from "@/lib/api-response";

export async function GET() {
  try {
    await requireUser({ owner: true });
    const approvals = await prisma.pendingApproval.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "desc" },
    });
    const now = new Date();
    const active = approvals.filter((a) => a.timeoutAt >= now);
    return NextResponse.json({ data: active, success: true });
  } catch (e) {
    return routeErrorResponse(e, "Lỗi khi tải");
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireUser({ owner: true });
    const { id, decision } = await req.json();
    if (!id || !["approved", "rejected"].includes(decision)) {
      return NextResponse.json({ error: "Thiếu id hoặc decision không hợp lệ", success: false }, { status: 400 });
    }
    const status = await checkApproval(id);
    if (status !== "pending") {
      return NextResponse.json({ error: `Approval đã ${status}`, success: false }, { status: 400 });
    }
    const result = await executeApproval(id, decision);
    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    return routeErrorResponse(e, "Lỗi không xác định");
  }
}
