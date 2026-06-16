import { prisma } from "@/lib/db";
import { generateMorningBrief } from "@/lib/morning-brief";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    // Get or generate today's brief
    const brief = await generateMorningBrief();
    return NextResponse.json({ data: brief, success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, id } = body;

    if (action === "dismiss") {
      await prisma.morningBrief.update({ where: { id }, data: { dismissed: true } });
      return NextResponse.json({ success: true });
    }

    if (action === "regenerate") {
      const today = new Date().toISOString().slice(0, 10);
      await prisma.morningBrief.deleteMany({ where: { date: today } });
      const brief = await generateMorningBrief();
      return NextResponse.json({ data: brief, success: true });
    }

    return NextResponse.json({ error: "Action không hợp lệ", success: false }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}
