import { prisma } from "@/lib/db";
import { accessErrorResponse, requireUser } from "@/lib/page-access";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser({ owner: true });
    const { id } = await params;
    const body = await req.json();
    const { category, title, content, order } = body;
    const item = await prisma.brandKnowledge.update({
      where: { id },
      data: {
        ...(category !== undefined ? { category } : {}),
        ...(title !== undefined ? { title } : {}),
        ...(content !== undefined ? { content } : {}),
        ...(typeof order === "number" ? { order } : {}),
      },
    });
    return NextResponse.json({ data: item, success: true });
  } catch (error) {
    const accessResponse = accessErrorResponse(error);
    if (accessResponse) return accessResponse;
    return NextResponse.json({ error: "Lỗi khi cập nhật", success: false }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser({ owner: true });
    const { id } = await params;
    await prisma.brandKnowledge.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const accessResponse = accessErrorResponse(error);
    if (accessResponse) return accessResponse;
    return NextResponse.json({ error: "Lỗi khi xóa", success: false }, { status: 500 });
  }
}
