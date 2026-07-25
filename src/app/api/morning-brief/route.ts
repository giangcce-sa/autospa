import { prisma } from "@/lib/db";
import { generateMorningBrief, getMorningBrief } from "@/lib/morning-brief";
import { accessErrorResponse, requireUser } from "@/lib/page-access";
import { businessDateKey } from "@/lib/today-policy";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    await requireUser({ owner: true });
    const brief = await getMorningBrief();
    return NextResponse.json({ data: brief, success: true });
  } catch (err) {
    const access = accessErrorResponse(err);
    if (access) return access;
    const msg = err instanceof Error ? err.message : "Lỗi";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireUser({ owner: true });
    const body = await req.json();
    const { action, id } = body;

    if (action === "dismiss" && typeof id === "string" && id) {
      await prisma.morningBrief.update({ where: { id }, data: { dismissed: true } });
      return NextResponse.json({ success: true });
    }

    if (action === "regenerate") {
      await prisma.morningBrief.deleteMany({ where: { date: businessDateKey() } });
      const brief = await generateMorningBrief();
      return NextResponse.json({ data: brief, success: true });
    }

    return NextResponse.json({ error: "Action không hợp lệ", success: false }, { status: 400 });
  } catch (err) {
    const access = accessErrorResponse(err);
    if (access) return access;
    const msg = err instanceof Error ? err.message : "Lỗi";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}
