import { prisma } from "@/lib/db";
import { accessErrorResponse, requireUser } from "@/lib/page-access";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    await requireUser();
    const items = await prisma.brandKnowledge.findMany({ orderBy: [{ category: "asc" }, { order: "asc" }] });
    return NextResponse.json({ data: items, success: true });
  } catch (error) {
    const accessResponse = accessErrorResponse(error);
    if (accessResponse) return accessResponse;
    return NextResponse.json({ error: "Lỗi khi tải dữ liệu", success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireUser({ owner: true });
    const body = await req.json();
    const { category, title, content } = body;
    if (!category || !title || !content) return NextResponse.json({ error: "Thiếu thông tin", success: false }, { status: 400 });
    const item = await prisma.brandKnowledge.create({ data: { category, title, content } });
    return NextResponse.json({ data: item, success: true });
  } catch (error) {
    const accessResponse = accessErrorResponse(error);
    if (accessResponse) return accessResponse;
    return NextResponse.json({ error: "Lỗi khi lưu", success: false }, { status: 500 });
  }
}
