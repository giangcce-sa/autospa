import { prisma } from "@/lib/db";
import { accessErrorResponse, getAuthorizedPageIds, requirePageAccess, requireUser } from "@/lib/page-access";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const authorizedPageIds = await getAuthorizedPageIds(user);
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
    const facebookPageId = searchParams.get("facebookPageId");
    if (facebookPageId) await requirePageAccess(facebookPageId);

    const posts = await prisma.post.findMany({
      where: {
        ...(facebookPageId
          ? { facebookPageId }
          : authorizedPageIds
            ? { facebookPageId: { in: authorizedPageIds } }
            : {}),
        ...(status ? { status } : {}),
      },
      include: { service: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ data: posts, success: true });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return NextResponse.json({ error: "Lỗi khi tải", success: false }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Thiếu id", success: false }, { status: 400 });
    const post = await prisma.post.findUnique({ where: { id }, select: { facebookPageId: true } });
    if (!post) return NextResponse.json({ error: "Không tìm thấy bài", success: false }, { status: 404 });
    await requirePageAccess(post.facebookPageId);
    await prisma.post.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return NextResponse.json({ error: "Lỗi khi xóa", success: false }, { status: 500 });
  }
}
