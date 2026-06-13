import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    // Auto-cleanup expired posts based on retention settings
    const settings = await prisma.settings.findFirst();
    if (settings) {
      const now = new Date();
      if (settings.draftRetentionDays > 0) {
        const cutoff = new Date(now.getTime() - settings.draftRetentionDays * 86400000);
        await prisma.post.deleteMany({ where: { status: "draft", createdAt: { lt: cutoff } } });
      }
      if (settings.publishedRetentionDays > 0) {
        const cutoff = new Date(now.getTime() - settings.publishedRetentionDays * 86400000);
        await prisma.post.deleteMany({ where: { status: "published", publishedAt: { lt: cutoff } } });
      }
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const posts = await prisma.post.findMany({
      where: status ? { status } : undefined,
      include: { service: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ data: posts, success: true });
  } catch {
    return NextResponse.json({ error: "Lỗi khi tải", success: false }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    await prisma.post.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Lỗi khi xóa", success: false }, { status: 500 });
  }
}
