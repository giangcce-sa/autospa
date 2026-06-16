import { prisma } from "@/lib/db";
import { syncOneCompetitor, getTopCompetitorPosts } from "@/lib/competitor-research";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const days = Number(searchParams.get("days") ?? 7);

    const [competitors, topPosts] = await Promise.all([
      prisma.competitor.findMany({
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { posts: true } } },
      }),
      getTopCompetitorPosts(days, 10),
    ]);

    return NextResponse.json({ data: { competitors, topPosts }, success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "create") {
      const { fbPageId, name, notes, accessToken } = body;
      if (!fbPageId?.trim() || !name?.trim()) {
        return NextResponse.json({ error: "Thiếu fbPageId hoặc name", success: false }, { status: 400 });
      }
      const competitor = await prisma.competitor.create({
        data: {
          fbPageId: fbPageId.trim(),
          name: name.trim(),
          notes: notes || null,
          accessToken: accessToken || null,
        },
      });
      return NextResponse.json({ data: competitor, success: true });
    }

    if (action === "update") {
      const { id, ...fields } = body as { id: string } & Record<string, unknown>;
      const allowed = ["name", "notes", "accessToken", "isActive"] as const;
      const data: Record<string, unknown> = {};
      for (const k of allowed) if (fields[k] !== undefined) data[k] = fields[k];
      const competitor = await prisma.competitor.update({ where: { id }, data });
      return NextResponse.json({ data: competitor, success: true });
    }

    if (action === "delete") {
      await prisma.competitor.delete({ where: { id: body.id } });
      return NextResponse.json({ success: true });
    }

    if (action === "fetch-now") {
      const result = await syncOneCompetitor(body.id);
      return NextResponse.json({ data: result, success: true });
    }

    return NextResponse.json({ error: "Action không hợp lệ", success: false }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}
