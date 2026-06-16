import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { prisma } from "@/lib/db";
import { postToZalo } from "@/lib/zalo";
import { buildBackupGzip } from "@/lib/backup";
import { finishJobRun, logActivity, startJobRun } from "@/lib/activity-log";

/**
 * Weekly backup reminder. Computes backup size + row count, sends Zalo
 * to admin so they download manually.
 *
 * Schedule (vercel.json): "0 3 * * 0" (3h sáng CN)
 */
export async function GET(req: NextRequest) {
  const denied = verifyCronAuth(req);
  if (denied) return denied;

  const job = await startJobRun("backup_reminder", "cron", "Weekly backup reminder").catch(() => null);
  try {
    const settings = await prisma.settings.findFirst();
    if (!settings?.zaloApprovalRecipient) {
      if (job) {
        await finishJobRun(job.id, {
          status: "skipped",
          summary: "No Zalo recipient configured",
        }).catch(() => null);
      }
      await logActivity({
        type: "job_run",
        title: "Backup reminder skipped",
        detail: "No Zalo recipient configured",
        href: "/settings",
        severity: "warning",
        source: "cron",
      }).catch(() => null);
      return NextResponse.json({ skipped: "no Zalo recipient" });
    }

    const { size, rowCount } = await buildBackupGzip();
    const sizeMb = (size / 1024 / 1024).toFixed(2);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://your-deployment.vercel.app";
    const msg = `📦 Weekly backup ready\nKích thước: ${sizeMb} MB\nDữ liệu: ${rowCount.toLocaleString("vi-VN")} bản ghi\n\nVào ${baseUrl}/settings → tab Backup → nhấn Download để lưu file.\nGiữ ít nhất 4 backup gần nhất.`;
    await postToZalo(msg, undefined, settings.zaloApprovalRecipient);

    const metrics = { size, rowCount, sizeMb };
    if (job) {
      await finishJobRun(job.id, {
        status: "completed",
        summary: `Backup reminder sent: ${sizeMb} MB, ${rowCount} rows`,
        metrics,
      }).catch(() => null);
    }
    await logActivity({
      type: "job_run",
      title: "Backup reminder sent",
      detail: `${sizeMb} MB · ${rowCount.toLocaleString("vi-VN")} rows`,
      href: "/settings",
      severity: "success",
      source: "cron",
      metadata: metrics,
    }).catch(() => null);

    return NextResponse.json({ size, rowCount, notified: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi";
    if (job) {
      await finishJobRun(job.id, {
        status: "failed",
        summary: "Backup reminder failed",
        error: msg,
      }).catch(() => null);
    }
    await logActivity({
      type: "job_run",
      title: "Backup reminder failed",
      detail: msg,
      href: "/settings",
      severity: "danger",
      source: "cron",
    }).catch(() => null);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
