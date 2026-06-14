import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const facebookPageId = new URL(req.url).searchParams.get("facebookPageId") || null;
    const services = await prisma.service.findMany({
      where: { facebookPageId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ data: services, success: true });
  } catch {
    return NextResponse.json({ error: "Lỗi khi tải dịch vụ", success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, price, category, duration, facebookPageId: rawPageId } = body;
    const facebookPageId = rawPageId || null;
    if (!name) return NextResponse.json({ error: "Tên dịch vụ là bắt buộc", success: false }, { status: 400 });

    const service = await prisma.service.create({
      data: { name, description, price, category, duration, facebookPageId },
    });
    return NextResponse.json({ data: service, success: true });
  } catch {
    return NextResponse.json({ error: "Lỗi khi tạo dịch vụ", success: false }, { status: 500 });
  }
}
