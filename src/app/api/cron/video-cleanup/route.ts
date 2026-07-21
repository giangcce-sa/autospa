import { NextRequest, NextResponse } from "next/server";
import { finishJobRun, startJobRun } from "@/lib/activity-log";
import { verifyCronAuth } from "@/lib/cron-auth";
import { prisma } from "@/lib/db";
import { deleteMedia } from "@/lib/media-storage";

export async function GET(req: NextRequest) {
  const denied = verifyCronAuth(req);
  if (denied) return denied;
  const run = await startJobRun("video_cleanup", "cron", "Remove old video versions and failed assets").catch(() => null);
  try {
    const cutoff = new Date(Date.now() - 30 * 86_400_000);
    const projects = await prisma.videoProject.findMany({
      select: { id: true, outputStorageKey: true, versions: { orderBy: { version: "desc" }, select: { id: true, storageKey: true, createdAt: true } } },
      take: 100,
    });
    const obsolete = projects.flatMap((project) => project.versions.slice(3).filter((version) => version.createdAt < cutoff && version.storageKey !== project.outputStorageKey));
    for (const version of obsolete) await deleteMedia(version.storageKey).catch(() => null);
    if (obsolete.length) await prisma.videoVersion.deleteMany({ where: { id: { in: obsolete.map((item) => item.id) } } });

    const failedAssets = await prisma.videoAsset.findMany({
      where: { status: { in: ["failed", "rejected"] }, createdAt: { lt: new Date(Date.now() - 7 * 86_400_000) } },
      select: { id: true, storageKey: true }, take: 100,
    });
    for (const asset of failedAssets) await deleteMedia(asset.storageKey).catch(() => null);
    if (failedAssets.length) await prisma.videoAsset.deleteMany({ where: { id: { in: failedAssets.map((item) => item.id) } } });
    const removed = obsolete.length + failedAssets.length;
    if (run) await finishJobRun(run.id, { status: "completed", summary: `Removed ${removed} stale video item(s)`, metrics: { removed } }).catch(() => null);
    return NextResponse.json({ success: true, removed });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (run) await finishJobRun(run.id, { status: "failed", summary: "Video cleanup failed", error: message }).catch(() => null);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
