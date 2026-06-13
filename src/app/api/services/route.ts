import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    const services = await prisma.service.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json({ data: services, success: true });
  } catch {
    return NextResponse.json({ error: "Lỗi khi tải dịch vụ", success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, price, category, duration } = body;
    if (!name) return NextResponse.json({ error: "Tên dịch vụ là bắt buộc", success: false }, { status: 400 });

    const service = await prisma.service.create({ data: { name, description, price, category, duration } });
    return NextResponse.json({ data: service, success: true });
  } catch {
    return NextResponse.json({ error: "Lỗi khi tạo dịch vụ", success: false }, { status: 500 });
  }
}
