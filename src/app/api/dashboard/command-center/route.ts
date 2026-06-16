import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Priority = "critical" | "high" | "medium" | "low";
type QueueType = "approval" | "review" | "publish" | "lead" | "message" | "appointment" | "alert" | "care";

interface QueueItem {
  id: string;
  type: QueueType;
  priority: Priority;
  title: string;
  detail: string;
  href: string;
  primaryAction: string;
  secondaryAction?: string;
  dueLabel?: string;
  timestamp?: string;
}

function truncate(text: string, max = 96) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function rankPriority(priority: Priority) {
  const score: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return score[priority];
}

export async function GET() {
  try {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalPosts,
      publishedThisMonth,
      scheduled,
      pendingAppointments,
      unreadMessages,
      services,
      totalCustomers,
      leadsTodayCount,
      hotLeadsCount,
      pendingCare,
      unreadAlerts,
      revenueToday,
      bookingsToday,
      pendingApprovalCount,
      adsPendingApprovalCount,
      pendingApprovals,
      reviewBlockedPosts,
      reviewBlockedCount,
      scheduledToday,
      hotLeads,
      messages,
      appointments,
      careDue,
      alerts,
      leadStageCounts,
      contentStatusCounts,
      adLogsToday,
      recentAdLogs,
      recentActivity,
      recentJobs,
      recentWorkflowRuns,
    ] = await Promise.all([
      prisma.post.count(),
      prisma.post.count({ where: { status: "published", publishedAt: { gte: startOfMonth } } }),
      prisma.post.count({ where: { status: "scheduled" } }),
      prisma.appointmentRequest.count({ where: { status: "pending" } }),
      prisma.inboxMessage.count({ where: { isRead: false } }),
      prisma.service.count({ where: { active: true } }),
      prisma.customer.count(),
      prisma.lead.count({ where: { createdAt: { gte: startOfDay, lte: endOfDay } } }),
      prisma.lead.count({ where: { stage: "hot" } }),
      prisma.careMessage.count({ where: { status: "pending" } }),
      prisma.socialAlert.count({ where: { isRead: false } }),
      prisma.bookingRevenue.aggregate({ where: { paidAt: { gte: startOfDay, lte: endOfDay } }, _sum: { amount: true } }),
      prisma.bookingRevenue.count({ where: { paidAt: { gte: startOfDay, lte: endOfDay } } }),
      prisma.pendingApproval.count({ where: { status: "pending", timeoutAt: { gte: now } } }),
      prisma.pendingApproval.count({
        where: {
          status: "pending",
          timeoutAt: { gte: now },
          type: { contains: "ad", mode: "insensitive" },
        },
      }),
      prisma.pendingApproval.findMany({
        where: { status: "pending", timeoutAt: { gte: now } },
        orderBy: { createdAt: "asc" },
        take: 5,
      }),
      prisma.post.findMany({
        where: {
          OR: [
            { review: { is: { status: "fail" } } },
            { qualityNotes: { contains: "BLOCKED", mode: "insensitive" } },
          ],
        },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, caption: true, platform: true, qualityNotes: true, updatedAt: true },
      }),
      prisma.post.count({
        where: {
          OR: [
            { review: { is: { status: "fail" } } },
            { qualityNotes: { contains: "BLOCKED", mode: "insensitive" } },
          ],
        },
      }),
      prisma.post.findMany({
        where: { status: "scheduled", scheduledAt: { gte: now, lte: endOfDay } },
        orderBy: { scheduledAt: "asc" },
        take: 5,
        select: { id: true, caption: true, platform: true, scheduledAt: true },
      }),
      prisma.lead.findMany({
        where: { stage: "hot" },
        orderBy: [{ nextFollowUp: "asc" }, { updatedAt: "desc" }],
        take: 5,
        select: { id: true, name: true, service: true, source: true, score: true, stage: true, nextFollowUp: true, updatedAt: true },
      }),
      prisma.inboxMessage.findMany({
        where: { isRead: false },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, senderName: true, message: true, createdAt: true },
      }),
      prisma.appointmentRequest.findMany({
        where: { status: "pending" },
        orderBy: { createdAt: "asc" },
        take: 5,
        select: { id: true, name: true, service: true, preferredAt: true, createdAt: true },
      }),
      prisma.careMessage.findMany({
        where: { status: "pending", OR: [{ scheduledAt: null }, { scheduledAt: { lte: endOfDay } }] },
        orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
        take: 5,
        select: { id: true, type: true, platform: true, scheduledAt: true, createdAt: true },
      }),
      prisma.realtimeAlert.findMany({
        where: { acknowledged: false },
        orderBy: { detectedAt: "desc" },
        take: 5,
      }),
      prisma.lead.groupBy({ by: ["stage"], _count: { _all: true } }),
      prisma.post.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.adOptimizationLog.count({ where: { createdAt: { gte: startOfDay, lte: endOfDay } } }),
      prisma.adOptimizationLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, campaignId: true, campaignName: true, action: true, reason: true, oldValue: true, newValue: true, createdAt: true },
      }),
      prisma.activityLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      prisma.jobRun.findMany({
        orderBy: { startedAt: "desc" },
        take: 6,
      }),
      prisma.workflowRun.findMany({
        orderBy: { startedAt: "desc" },
        take: 6,
        select: { id: true, name: true, trigger: true, status: true, startedAt: true, completedAt: true },
      }),
    ]);

    const leadStageLabels: Record<string, string> = {
      cold: "Cold",
      warm: "Warm",
      hot: "Hot",
      booked: "Booked",
      closed: "Closed",
    };
    const leadStageOrder = ["cold", "warm", "hot", "booked", "closed"];
    const leadStageMap = new Map(leadStageCounts.map((row) => [row.stage, row._count._all]));
    const leadTotal = leadStageCounts.reduce((sum, row) => sum + row._count._all, 0);
    const leadPipeline = leadStageOrder.map((stage) => {
      const count = leadStageMap.get(stage) ?? 0;
      return {
        stage,
        label: leadStageLabels[stage],
        count,
        percent: leadTotal > 0 ? Math.round((count / leadTotal) * 100) : 0,
      };
    });

    const contentStatusMap = new Map(contentStatusCounts.map((row) => [row.status, row._count._all]));
    const failedJobs = recentJobs.filter((job) => job.status === "failed").length;

    const queue: QueueItem[] = [
      ...pendingApprovals.map((item): QueueItem => ({
        id: `approval:${item.id}`,
        type: "approval",
        priority: "critical",
        title: `Cần duyệt: ${item.type.replace(/_/g, " ")}`,
        detail: `Mã ${item.shortCode} hết hạn lúc ${formatTime(item.timeoutAt)}`,
        href: "/automation",
        primaryAction: "Duyệt",
        secondaryAction: "Xem payload",
        dueLabel: `Hết hạn ${formatTime(item.timeoutAt)}`,
        timestamp: item.createdAt.toISOString(),
      })),
      ...reviewBlockedPosts.map((post): QueueItem => ({
        id: `review:${post.id}`,
        type: "review",
        priority: "critical",
        title: "Bài bị Reviewer chặn",
        detail: truncate(post.qualityNotes || post.caption),
        href: `/publish?postId=${post.id}`,
        primaryAction: "Sửa bài",
        secondaryAction: "Xem lỗi",
        timestamp: post.updatedAt.toISOString(),
      })),
      ...alerts.map((alert): QueueItem => ({
        id: `alert:${alert.id}`,
        type: "alert",
        priority: alert.severity === "critical" ? "critical" : "high",
        title: alert.type.replace(/_/g, " "),
        detail: truncate(alert.signal),
        href: "/listening",
        primaryAction: "Xử lý",
        secondaryAction: "Đánh dấu",
        timestamp: alert.detectedAt.toISOString(),
      })),
      ...hotLeads.map((lead): QueueItem => ({
        id: `lead:${lead.id}`,
        type: "lead",
        priority: "high",
        title: `Lead nóng: ${lead.name}`,
        detail: `${lead.service ?? "Chưa rõ dịch vụ"} · ${lead.source}`,
        href: `/sale?leadId=${lead.id}`,
        primaryAction: "Chăm sóc",
        secondaryAction: "Mở hồ sơ",
        dueLabel: lead.nextFollowUp ? `Follow-up ${formatTime(lead.nextFollowUp)}` : undefined,
        timestamp: lead.updatedAt.toISOString(),
      })),
      ...messages.map((msg): QueueItem => ({
        id: `message:${msg.id}`,
        type: "message",
        priority: "high",
        title: `Tin nhắn mới: ${msg.senderName}`,
        detail: truncate(msg.message),
        href: "/inbox",
        primaryAction: "Trả lời",
        secondaryAction: "Xem inbox",
        timestamp: msg.createdAt.toISOString(),
      })),
      ...appointments.map((appt): QueueItem => ({
        id: `appointment:${appt.id}`,
        type: "appointment",
        priority: "medium",
        title: `Lịch hẹn chờ xác nhận: ${appt.name}`,
        detail: `${appt.service ?? "Chưa rõ dịch vụ"}${appt.preferredAt ? ` · ${appt.preferredAt}` : ""}`,
        href: "/appointments",
        primaryAction: "Xác nhận",
        secondaryAction: "Xem lịch",
        timestamp: appt.createdAt.toISOString(),
      })),
      ...scheduledToday.map((post): QueueItem => ({
        id: `publish:${post.id}`,
        type: "publish",
        priority: "medium",
        title: `Bài lên lịch ${post.scheduledAt ? formatTime(post.scheduledAt) : "hôm nay"}`,
        detail: `${post.platform} · ${truncate(post.caption)}`,
        href: `/publish?postId=${post.id}`,
        primaryAction: "Kiểm tra",
        secondaryAction: "Mở lịch",
        dueLabel: post.scheduledAt ? formatTime(post.scheduledAt) : undefined,
        timestamp: post.scheduledAt?.toISOString(),
      })),
      ...careDue.map((care): QueueItem => ({
        id: `care:${care.id}`,
        type: "care",
        priority: "low",
        title: `Chăm sóc khách: ${care.type}`,
        detail: `${care.platform}${care.scheduledAt ? ` · ${formatTime(care.scheduledAt)}` : ""}`,
        href: "/care",
        primaryAction: "Gửi",
        secondaryAction: "Xem care",
        dueLabel: care.scheduledAt ? formatTime(care.scheduledAt) : "Hôm nay",
        timestamp: (care.scheduledAt ?? care.createdAt).toISOString(),
      })),
    ].sort((a, b) => {
      const byPriority = rankPriority(a.priority) - rankPriority(b.priority);
      if (byPriority !== 0) return byPriority;
      return new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime();
    }).slice(0, 12);

    const criticalTasks = queue.filter((item) => item.priority === "critical").length;

    return NextResponse.json({
      data: {
        stats: {
          totalPosts,
          publishedThisMonth,
          scheduled,
          pendingAppointments,
          unreadMessages,
          services,
          totalCustomers,
          leadsToday: leadsTodayCount,
          hotLeads: hotLeadsCount,
          pendingCare,
          unreadAlerts,
        },
        kpis: {
          revenueToday: revenueToday._sum.amount ?? 0,
          bookingsToday,
          leadsToday: leadsTodayCount,
          pendingApprovals: pendingApprovalCount,
          criticalTasks,
          queueTotal: queue.length,
        },
        todayQueue: queue,
        leadPipeline: {
          total: leadTotal,
          stages: leadPipeline,
        },
        hotLeads: hotLeads.map((lead) => ({
          id: lead.id,
          name: lead.name,
          service: lead.service,
          source: lead.source,
          score: lead.score,
          stage: lead.stage,
          nextFollowUp: lead.nextFollowUp?.toISOString(),
          updatedAt: lead.updatedAt.toISOString(),
          href: `/sale?leadId=${lead.id}`,
        })),
        contentFactory: {
          total: totalPosts,
          draft: contentStatusMap.get("draft") ?? 0,
          scheduled,
          publishedThisMonth,
          reviewBlocked: reviewBlockedCount,
          scheduledToday: scheduledToday.length,
          byStatus: Object.fromEntries(contentStatusMap),
          itemsNeedingReview: reviewBlockedPosts.map((post) => ({
            id: post.id,
            platform: post.platform,
            caption: truncate(post.caption, 120),
            detail: post.qualityNotes,
            updatedAt: post.updatedAt.toISOString(),
            href: `/publish?postId=${post.id}`,
          })),
        },
        adsCommand: {
          actionsToday: adLogsToday,
          pendingApprovals: adsPendingApprovalCount,
          recentActions: recentAdLogs.map((log) => ({
            id: log.id,
            campaignId: log.campaignId,
            campaignName: log.campaignName,
            action: log.action,
            reason: log.reason,
            oldValue: log.oldValue,
            newValue: log.newValue,
            createdAt: log.createdAt.toISOString(),
          })),
        },
        aiTasks: {
          failedJobs,
          recentJobs: recentJobs.map((job) => ({
            id: job.id,
            name: job.name,
            status: job.status,
            trigger: job.trigger,
            summary: job.summary,
            startedAt: job.startedAt.toISOString(),
            completedAt: job.completedAt?.toISOString(),
          })),
          recentWorkflowRuns: recentWorkflowRuns.map((run) => ({
            id: run.id,
            name: run.name,
            trigger: run.trigger,
            status: run.status,
            startedAt: run.startedAt.toISOString(),
            completedAt: run.completedAt?.toISOString(),
          })),
        },
        activity: recentActivity.map((item) => ({
          id: item.id,
          type: item.type,
          title: item.title,
          detail: item.detail,
          href: item.href,
          severity: item.severity,
          source: item.source,
          timestamp: item.createdAt.toISOString(),
        })),
        highlights: {
          approvals: pendingApprovalCount,
          blockedPosts: reviewBlockedCount,
          alerts: alerts.length,
          scheduledToday: scheduledToday.length,
          failedJobs,
        },
      },
      success: true,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi khi tải command center";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}
