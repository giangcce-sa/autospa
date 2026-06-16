import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

interface ActivityItem {
  id: string;
  type: "post_published" | "lead_new" | "workflow_run" | "alert" | "revenue";
  title: string;
  detail?: string;
  href?: string;
  timestamp: string;
  severity?: "info" | "success" | "warning" | "danger";
}

export async function GET() {
  try {
    const since = new Date(Date.now() - 24 * 3600 * 1000);

    const [recentPosts, recentLeads, recentWorkflows, recentAlerts, recentRevenue] = await Promise.all([
      prisma.post.findMany({
        where: { status: "published", publishedAt: { gte: since } },
        select: { id: true, caption: true, publishedAt: true, platform: true },
        orderBy: { publishedAt: "desc" },
        take: 5,
      }),
      prisma.lead.findMany({
        where: { createdAt: { gte: since } },
        select: { id: true, name: true, source: true, createdAt: true, stage: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.workflowRun.findMany({
        where: { startedAt: { gte: since } },
        select: { id: true, name: true, status: true, trigger: true, startedAt: true },
        orderBy: { startedAt: "desc" },
        take: 5,
      }),
      prisma.realtimeAlert.findMany({
        where: { detectedAt: { gte: since } },
        select: { id: true, type: true, signal: true, severity: true, detectedAt: true },
        orderBy: { detectedAt: "desc" },
        take: 5,
      }),
      prisma.bookingRevenue.findMany({
        where: { paidAt: { gte: since } },
        select: { id: true, amount: true, service: true, paidAt: true },
        orderBy: { paidAt: "desc" },
        take: 5,
      }),
    ]);

    const items: ActivityItem[] = [];

    for (const p of recentPosts) {
      items.push({
        id: `post-${p.id}`,
        type: "post_published",
        title: "Đã đăng bài",
        detail: p.caption.slice(0, 80),
        href: "/library",
        timestamp: p.publishedAt?.toISOString() ?? new Date().toISOString(),
        severity: "info",
      });
    }
    for (const l of recentLeads) {
      items.push({
        id: `lead-${l.id}`,
        type: "lead_new",
        title: `Lead mới: ${l.name}`,
        detail: `Từ ${l.source} · ${l.stage}`,
        href: "/sale",
        timestamp: l.createdAt.toISOString(),
        severity: l.stage === "hot" ? "warning" : "info",
      });
    }
    for (const w of recentWorkflows) {
      items.push({
        id: `wf-${w.id}`,
        type: "workflow_run",
        title: `Workflow: ${w.name}`,
        detail: w.trigger,
        href: "/orchestrator",
        timestamp: w.startedAt.toISOString(),
        severity: w.status === "failed" ? "danger" : w.status === "completed" ? "success" : "warning",
      });
    }
    for (const a of recentAlerts) {
      items.push({
        id: `alert-${a.id}`,
        type: "alert",
        title: `Cảnh báo: ${a.type}`,
        detail: a.signal,
        href: "/orchestrator",
        timestamp: a.detectedAt.toISOString(),
        severity: a.severity === "critical" ? "danger" : "warning",
      });
    }
    for (const r of recentRevenue) {
      items.push({
        id: `rev-${r.id}`,
        type: "revenue",
        title: `+${r.amount.toLocaleString("vi-VN")}đ doanh thu`,
        detail: r.service ?? undefined,
        href: "/reports",
        timestamp: r.paidAt.toISOString(),
        severity: "success",
      });
    }

    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({ data: items.slice(0, 12), success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}
