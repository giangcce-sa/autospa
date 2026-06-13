import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const item = await prisma.brandKnowledge.update({ where: { id }, data: body });
    return NextResponse.json({ data: item, success: true });
  } catch {
    return NextResponse.json({ error: "Lỗi khi cập nhật", success: false }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.brandKnowledge.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Lỗi khi xóa", success: false }, { status: 500 });
  }
}
