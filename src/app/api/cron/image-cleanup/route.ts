import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { prisma } from "@/lib/db";
import { deleteMedia } from "@/lib/media-storage";
import { finishJobRun, startJobRun } from "@/lib/activity-log";
import { routeErrorResponse } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  const denied = verifyCronAuth(req);
  if (denied) return denied;
  const job = await startJobRun("image_cleanup", "cron", "Remove unused generated images older than retention window").catch(() => null);
  try {
    const cutoff = new Date(Date.now() - 30 * 86_400_000);
    const stale = await prisma.imageGeneration.findMany({
      where: {
        createdAt: { lt: cutoff },
        postId: null,
        OR: [{ userAccepted: false }, { userAccepted: null }],
      },
      select: { id: true, storageKey: true },
      take: 100,
      orderBy: { createdAt: "asc" },
    });
    for (const item of stale) await deleteMedia(item.storageKey).catch(() => null);
    if (stale.length) await prisma.imageGeneration.deleteMany({ where: { id: { in: stale.map((item) => item.id) } } });
    if (job) await finishJobRun(job.id, { status: "completed", summary: `Removed ${stale.length} stale image(s)`, metrics: { removed: stale.length } }).catch(() => null);
    return NextResponse.json({ success: true, removed: stale.length });
  } catch (error) {
    if (job) await finishJobRun(job.id, { status: "failed", summary: "Image cleanup failed", error: "Thất bại" }).catch(() => null);
    return routeErrorResponse(error, "Lỗi khi dọn dẹp ảnh");
  }
}
