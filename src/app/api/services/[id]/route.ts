import { prisma } from "@/lib/db";
import { AccessError, accessErrorResponse, requireExplicitPageAccess } from "@/lib/page-access";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const existing = await prisma.service.findUnique({ where: { id }, select: { facebookPageId: true } });
    if (!existing) throw new AccessError("Không tìm thấy dịch vụ", 404);
    await requireExplicitPageAccess(existing.facebookPageId, { owner: true });
    const body = await req.json();
    const { name, description, price, category, duration, active } = body;
    const service = await prisma.service.update({ where: { id }, data: { name, description, price, category, duration, active } });
    return NextResponse.json({ data: service, success: true });
  } catch (error) {
    const accessResponse = accessErrorResponse(error);
    if (accessResponse) return accessResponse;
    return NextResponse.json({ error: "Lỗi khi cập nhật", success: false }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const existing = await prisma.service.findUnique({ where: { id }, select: { facebookPageId: true } });
    if (!existing) throw new AccessError("Không tìm thấy dịch vụ", 404);
    await requireExplicitPageAccess(existing.facebookPageId, { owner: true });
    await prisma.service.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const accessResponse = accessErrorResponse(error);
    if (accessResponse) return accessResponse;
    return NextResponse.json({ error: "Lỗi khi xóa", success: false }, { status: 500 });
  }
}
