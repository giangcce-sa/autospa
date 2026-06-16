import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    const rules = await prisma.messageRule.findMany({
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json({ data: rules, success: true });
  } catch {
    return NextResponse.json({ error: "Lỗi khi tải", success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "create") {
      const { trigger, reply, matchMode, priority, channel } = body;
      if (!trigger?.trim() || !reply?.trim()) {
        return NextResponse.json({ error: "Trigger và reply không được trống", success: false }, { status: 400 });
      }
      const rule = await prisma.messageRule.create({
        data: {
          trigger: trigger.trim(),
          reply: reply.trim(),
          matchMode: matchMode ?? "contains",
          priority: priority ?? 0,
          channel: channel ?? "both",
        },
      });
      return NextResponse.json({ data: rule, success: true });
    }

    if (action === "update") {
      const { id, trigger, reply, matchMode, priority, channel, isActive } = body;
      const rule = await prisma.messageRule.update({
        where: { id },
        data: {
          ...(trigger !== undefined ? { trigger: trigger.trim() } : {}),
          ...(reply !== undefined ? { reply: reply.trim() } : {}),
          ...(matchMode !== undefined ? { matchMode } : {}),
          ...(priority !== undefined ? { priority } : {}),
          ...(channel !== undefined ? { channel } : {}),
          ...(isActive !== undefined ? { isActive } : {}),
        },
      });
      return NextResponse.json({ data: rule, success: true });
    }

    if (action === "toggle") {
      const rule = await prisma.messageRule.findUnique({ where: { id: body.id } });
      if (!rule) return NextResponse.json({ error: "Not found", success: false }, { status: 404 });
      await prisma.messageRule.update({ where: { id: body.id }, data: { isActive: !rule.isActive } });
      return NextResponse.json({ success: true });
    }

    if (action === "delete") {
      await prisma.messageRule.delete({ where: { id: body.id } });
      return NextResponse.json({ success: true });
    }

    if (action === "test") {
      const { text, channel } = body as { text: string; channel: "facebook" | "zalo" };
      const { matchMessageRule } = await import("@/lib/message-rules");
      const match = await matchMessageRule(text, channel ?? "facebook");
      return NextResponse.json({ data: match, success: true });
    }

    return NextResponse.json({ error: "Action không hợp lệ", success: false }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}
