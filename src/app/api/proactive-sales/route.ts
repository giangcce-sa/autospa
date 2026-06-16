import { prisma } from "@/lib/db";
import { runProactiveOutreach } from "@/lib/proactive-sales";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    // List recent proactive messages sent
    const messages = await prisma.careMessage.findMany({
      where: { type: { startsWith: "proactive_" } },
      include: { customer: { select: { id: true, name: true, segment: true } } },
      orderBy: { sentAt: "desc" },
      take: 50,
    });

    const byType: Record<string, number> = {};
    for (const m of messages) byType[m.type] = (byType[m.type] ?? 0) + 1;

    return NextResponse.json({
      data: { messages, byType, total: messages.length },
      success: true,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.action === "run-now") {
      const result = await runProactiveOutreach();
      return NextResponse.json({ data: result, success: true });
    }
    return NextResponse.json({ error: "Action không hợp lệ", success: false }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}
