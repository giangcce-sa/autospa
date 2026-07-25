import "server-only";

import { getCanonicalRouteHref } from "@/config/routes";

import { prisma } from "@/lib/db";
import { BUSINESS_TIME_ZONE, buildTodayQueueTotals, getBusinessDayRange, getBusinessMonthRange } from "@/lib/today-policy";

type Priority = "critical" | "high" | "medium" | "low";
type QueueType = "approval" | "review" | "publish" | "lead" | "message" | "appointment" | "alert" | "care";

export interface TodayQueueItem {
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
  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: BUSINESS_TIME_ZONE,
  });
}

function rankPriority(priority: Priority) {
  const score: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return score[priority];
}

function platformLabel(value: string) {
  const labels: Record<string, string> = { facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", zalo: "Zalo", multi: "Nhiều kênh" };
  return labels[value.toLowerCase()] || value;
}

function sourceLabel(value: string) {
  const labels: Record<string, string> = { facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", zalo: "Zalo", manual: "Nhập thủ công", website: "Website", referral: "Khách giới thiệu" };
  return labels[value.toLowerCase()] || value;
}

function approvalLabel(value: string) {
  const labels: Record<string, string> = {
    ad_budget_increase: "Tăng ngân sách quảng cáo", ad_pause: "Tạm dừng quảng cáo",
    post_publish: "Đăng nội dung", content_publish: "Đăng nội dung", workflow_action: "Thực hiện quy trình tự động",
  };
  return labels[value.toLowerCase()] || value.replace(/_/g, " ");
}

function alertLabel(value: string) {
  const labels: Record<string, string> = {
    negative_sentiment: "Phản hồi tiêu cực", competitor_spike: "Đối thủ tăng hoạt động",
    ad_anomaly: "Quảng cáo có dấu hiệu bất thường", spend_spike: "Chi phí quảng cáo tăng đột biến",
    engagement_drop: "Tương tác đang giảm", system_error: "Hệ thống gặp lỗi",
  };
  return labels[value.toLowerCase()] || value.replace(/_/g, " ");
}

function careLabel(value: string) {
  const labels: Record<string, string> = { follow_up: "Hỏi thăm sau dịch vụ", reminder: "Nhắc lịch", birthday: "Chúc mừng sinh nhật", reactivation: "Mời khách quay lại", aftercare: "Hướng dẫn chăm sóc" };
  return labels[value.toLowerCase()] || value.replace(/_/g, " ");
}

export interface TodayScopeInput {
  scope: "current" | "all" | "account";
  pageIds: string[] | null;
  includeGlobal: boolean;
  canMutate: boolean;
  now?: Date;
}

export async function getTodayData({
  scope,
  pageIds,
  includeGlobal,
  canMutate,
  now = new Date(),
}: TodayScopeInput) {
    const pageIdFilter = pageIds ? { in: pageIds } : undefined;
    const postScope = pageIdFilter ? { facebookPageId: pageIdFilter } : {};
    const messageScope = pageIdFilter ? { facebookPageId: pageIdFilter } : {};
    const serviceScope = pageIdFilter ? { facebookPageId: pageIdFilter } : {};
    const leadScope = pageIdFilter ? { conversations: { some: { facebookPageId: pageIdFilter } } } : {};
    const customerScope = pageIdFilter ? { messages: { some: { facebookPageId: pageIdFilter } } } : {};
    const appointmentScope = pageIdFilter ? { customer: { is: customerScope } } : {};
    const careScope = pageIdFilter ? { customer: { is: customerScope } } : {};
    const revenueScope = pageIdFilter ? { lead: { is: leadScope } } : {};
    const globalScope = includeGlobal ? {} : { id: "__hidden_in_page_scope__" };
    const facebookPageId = pageIds?.length === 1 ? pageIds[0] : undefined;

    const { start: startOfDay, end: endOfDay } = getBusinessDayRange(now);
    const { start: startOfMonth } = getBusinessMonthRange(now);

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
      scheduledTodayCount,
      scheduledToday,
      hotLeads,
      messages,
      appointments,
      careDueCount,
      careDue,
      openAlertCount,
      criticalAlertCount,
      alerts,
      leadStageCounts,
      contentStatusCounts,
      adLogsToday,
      recentAdLogs,
      recentActivity,
      failedJobCount,
      recentJobs,
      recentWorkflowRuns,
    ] = await Promise.all([
      prisma.post.count({ where: postScope }),
      prisma.post.count({ where: { ...postScope, status: "published", publishedAt: { gte: startOfMonth } } }),
      prisma.post.count({ where: { ...postScope, status: "scheduled" } }),
      prisma.appointmentRequest.count({ where: { ...appointmentScope, status: "pending" } }),
      prisma.inboxMessage.count({ where: { ...messageScope, isRead: false } }),
      prisma.service.count({ where: { ...serviceScope, active: true } }),
      prisma.customer.count({ where: customerScope }),
      prisma.lead.count({ where: { ...leadScope, createdAt: { gte: startOfDay, lte: endOfDay } } }),
      prisma.lead.count({ where: { ...leadScope, stage: "hot" } }),
      prisma.careMessage.count({ where: { ...careScope, status: "pending" } }),
      prisma.socialAlert.count({ where: { ...globalScope, isRead: false } }),
      prisma.bookingRevenue.aggregate({ where: { ...revenueScope, paidAt: { gte: startOfDay, lte: endOfDay } }, _sum: { amount: true } }),
      prisma.bookingRevenue.count({ where: { ...revenueScope, paidAt: { gte: startOfDay, lte: endOfDay } } }),
      prisma.pendingApproval.count({ where: { ...globalScope, status: "pending", timeoutAt: { gte: now } } }),
      prisma.pendingApproval.count({
        where: {
          ...globalScope,
          status: "pending",
          timeoutAt: { gte: now },
          type: { contains: "ad", mode: "insensitive" },
        },
      }),
      prisma.pendingApproval.findMany({
        where: { ...globalScope, status: "pending", timeoutAt: { gte: now } },
        orderBy: { createdAt: "asc" },
        take: 5,
      }),
      prisma.post.findMany({
        where: {
          ...postScope,
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
          ...postScope,
          OR: [
            { review: { is: { status: "fail" } } },
            { qualityNotes: { contains: "BLOCKED", mode: "insensitive" } },
          ],
        },
      }),
      prisma.post.count({
        where: { ...postScope, status: "scheduled", scheduledAt: { gte: startOfDay, lte: endOfDay } },
      }),
      prisma.post.findMany({
        where: { ...postScope, status: "scheduled", scheduledAt: { gte: now, lte: endOfDay } },
        orderBy: { scheduledAt: "asc" },
        take: 5,
        select: { id: true, caption: true, platform: true, scheduledAt: true },
      }),
      prisma.lead.findMany({
        where: { ...leadScope, stage: "hot" },
        orderBy: [{ nextFollowUp: "asc" }, { updatedAt: "desc" }],
        take: 5,
        select: { id: true, name: true, service: true, source: true, score: true, stage: true, nextFollowUp: true, updatedAt: true },
      }),
      prisma.inboxMessage.findMany({
        where: { ...messageScope, isRead: false },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, senderName: true, message: true, createdAt: true },
      }),
      prisma.appointmentRequest.findMany({
        where: { ...appointmentScope, status: "pending" },
        orderBy: { createdAt: "asc" },
        take: 5,
        select: { id: true, name: true, service: true, preferredAt: true, createdAt: true },
      }),
      prisma.careMessage.count({
        where: { ...careScope, status: "pending", OR: [{ scheduledAt: null }, { scheduledAt: { lte: endOfDay } }] },
      }),
      prisma.careMessage.findMany({
        where: { ...careScope, status: "pending", OR: [{ scheduledAt: null }, { scheduledAt: { lte: endOfDay } }] },
        orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
        take: 5,
        select: { id: true, type: true, platform: true, scheduledAt: true, createdAt: true },
      }),
      prisma.realtimeAlert.count({ where: { ...globalScope, acknowledged: false } }),
      prisma.realtimeAlert.count({ where: { ...globalScope, acknowledged: false, severity: "critical" } }),
      prisma.realtimeAlert.findMany({
        where: { ...globalScope, acknowledged: false },
        orderBy: { detectedAt: "desc" },
        take: 5,
      }),
      prisma.lead.groupBy({ by: ["stage"], where: leadScope, _count: { _all: true } }),
      prisma.post.groupBy({ by: ["status"], where: postScope, _count: { _all: true } }),
      prisma.adOptimizationLog.count({ where: { ...globalScope, createdAt: { gte: startOfDay, lte: endOfDay } } }),
      prisma.adOptimizationLog.findMany({
        where: globalScope,
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, campaignId: true, campaignName: true, action: true, reason: true, oldValue: true, newValue: true, createdAt: true },
      }),
      prisma.activityLog.findMany({
        where: globalScope,
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      prisma.jobRun.count({ where: { ...globalScope, status: "failed" } }),
      prisma.jobRun.findMany({
        where: globalScope,
        orderBy: { startedAt: "desc" },
        take: 6,
      }),
      prisma.workflowRun.findMany({
        where: globalScope,
        orderBy: { startedAt: "desc" },
        take: 6,
        select: { id: true, name: true, trigger: true, status: true, startedAt: true, completedAt: true },
      }),
    ]);

    const leadStageLabels: Record<string, string> = {
      cold: "Mới tiếp cận",
      warm: "Đang quan tâm",
      hot: "Có khả năng đặt lịch",
      booked: "Đã đặt lịch",
      closed: "Đã hoàn tất",
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
    const queueTotals = buildTodayQueueTotals({
      pendingApprovals: pendingApprovalCount,
      reviewBlocked: reviewBlockedCount,
      openAlerts: openAlertCount,
      criticalAlerts: criticalAlertCount,
      hotLeads: hotLeadsCount,
      unreadMessages,
      pendingAppointments,
      scheduledToday: scheduledTodayCount,
      careDue: careDueCount,
    });

    const queue: TodayQueueItem[] = [
      ...pendingApprovals.map((item): TodayQueueItem => ({
        id: `approval:${item.id}`,
        type: "approval",
        priority: "critical",
        title: `Chờ bạn duyệt: ${approvalLabel(item.type)}`,
        detail: `Yêu cầu ${item.shortCode} cần xử lý trước ${formatTime(item.timeoutAt)}`,
        href: getCanonicalRouteHref("automation", "approvals"),
        primaryAction: "Duyệt",
        secondaryAction: "Xem chi tiết",
        dueLabel: `Xử lý trước ${formatTime(item.timeoutAt)}`,
        timestamp: item.createdAt.toISOString(),
      })),
      ...reviewBlockedPosts.map((post): TodayQueueItem => ({
        id: `review:${post.id}`,
        type: "review",
        priority: "critical",
        title: "Nội dung chưa đạt yêu cầu",
        detail: truncate(post.qualityNotes || post.caption),
        href: `/publish?postId=${post.id}`,
        primaryAction: "Sửa bài",
        secondaryAction: "Xem lỗi",
        timestamp: post.updatedAt.toISOString(),
      })),
      ...alerts.map((alert): TodayQueueItem => ({
        id: `alert:${alert.id}`,
        type: "alert",
        priority: alert.severity === "critical" ? "critical" : "high",
        title: alertLabel(alert.type),
        detail: truncate(alert.signal),
        href: "/listening",
        primaryAction: "Xử lý",
        secondaryAction: "Đánh dấu",
        timestamp: alert.detectedAt.toISOString(),
      })),
      ...hotLeads.map((lead): TodayQueueItem => ({
        id: `lead:${lead.id}`,
        type: "lead",
        priority: "high",
        title: `Khách cần ưu tiên: ${lead.name}`,
        detail: `${lead.service ?? "Chưa chọn dịch vụ"} · Nguồn ${sourceLabel(lead.source)}`,
        href: `/sale?leadId=${lead.id}`,
        primaryAction: "Chăm sóc",
        secondaryAction: "Mở hồ sơ",
        dueLabel: lead.nextFollowUp ? `Liên hệ lại lúc ${formatTime(lead.nextFollowUp)}` : undefined,
        timestamp: lead.updatedAt.toISOString(),
      })),
      ...messages.map((msg): TodayQueueItem => ({
        id: `message:${msg.id}`,
        type: "message",
        priority: "high",
        title: `Tin nhắn mới: ${msg.senderName}`,
        detail: truncate(msg.message),
        href: "/inbox",
        primaryAction: "Trả lời",
        secondaryAction: "Mở hộp thư",
        timestamp: msg.createdAt.toISOString(),
      })),
      ...appointments.map((appt): TodayQueueItem => ({
        id: `appointment:${appt.id}`,
        type: "appointment",
        priority: "medium",
        title: `Lịch hẹn chờ xác nhận: ${appt.name}`,
        detail: `${appt.service ?? "Chưa chọn dịch vụ"}${appt.preferredAt ? ` · Khách muốn đến ${appt.preferredAt}` : ""}`,
        href: "/appointments",
        primaryAction: "Xác nhận",
        secondaryAction: "Xem lịch",
        timestamp: appt.createdAt.toISOString(),
      })),
      ...scheduledToday.map((post): TodayQueueItem => ({
        id: `publish:${post.id}`,
        type: "publish",
        priority: "medium",
        title: `Bài lên lịch ${post.scheduledAt ? formatTime(post.scheduledAt) : "hôm nay"}`,
        detail: `${platformLabel(post.platform)} · ${truncate(post.caption)}`,
        href: `/publish?postId=${post.id}`,
        primaryAction: "Kiểm tra",
        secondaryAction: "Mở lịch",
        dueLabel: post.scheduledAt ? formatTime(post.scheduledAt) : undefined,
        timestamp: post.scheduledAt?.toISOString(),
      })),
      ...careDue.map((care): TodayQueueItem => ({
        id: `care:${care.id}`,
        type: "care",
        priority: "low",
        title: careLabel(care.type),
        detail: `${platformLabel(care.platform)}${care.scheduledAt ? ` · Gửi lúc ${formatTime(care.scheduledAt)}` : ""}`,
        href: "/care",
        primaryAction: "Gửi",
        secondaryAction: "Xem danh sách",
        dueLabel: care.scheduledAt ? formatTime(care.scheduledAt) : "Hôm nay",
        timestamp: (care.scheduledAt ?? care.createdAt).toISOString(),
      })),
    ].sort((a, b) => {
      const byPriority = rankPriority(a.priority) - rankPriority(b.priority);
      if (byPriority !== 0) return byPriority;
      return new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime();
    }).slice(0, 12);

    const setupPageScope = pageIdFilter ? { id: pageIdFilter, isActive: true } : { isActive: true };
    const setupRecordScope = pageIdFilter ? { facebookPageId: pageIdFilter } : {};
    const [settings, facebookPages, brandKnowledge, brandKits, styleSamples] = await Promise.all([
      canMutate ? prisma.settings.findFirst({
        select: { claudeApiKey: true, openaiApiKey: true },
      }) : Promise.resolve(null),
      prisma.facebookPage.count({ where: setupPageScope }),
      facebookPageId ? Promise.resolve(0) : prisma.brandKnowledge.count(),
      prisma.brandKit.count({ where: setupRecordScope }),
      prisma.styleSample.count({ where: setupRecordScope }),
    ]);

    const setupSteps = [
      {
        id: "ai",
        label: "Kết nối dịch vụ trí tuệ nhân tạo",
        description: "Cho phép AutoSpa hỗ trợ tạo nội dung và phân tích dữ liệu.",
        href: "/settings",
        complete: Boolean(settings?.claudeApiKey || settings?.openaiApiKey),
      },
      {
        id: "channel",
        label: "Kết nối Trang Facebook",
        description: "Nhận tin nhắn, đăng bài và theo dõi tương tác.",
        href: "/settings",
        complete: facebookPages > 0,
      },
      {
        id: "services",
        label: "Thêm dịch vụ spa",
        description: "Giúp AI tư vấn đúng dịch vụ và mức giá.",
        href: "/services",
        complete: services > 0,
      },
      {
        id: "brand",
        label: "Bổ sung thông tin thương hiệu",
        description: "Tên spa, chính sách, màu sắc và văn phong.",
        href: "/brand",
        complete: brandKnowledge > 0 || brandKits > 0 || styleSamples > 0,
      },
      {
        id: "first-content",
        label: "Tạo nội dung đầu tiên",
        description: "Tạo một bài mẫu để kiểm tra toàn bộ quy trình.",
        href: "/content",
        complete: totalPosts > 0,
      },
    ];
    const completedSetupSteps = setupSteps.filter((step) => step.complete).length;

    const asOf = now.toISOString();
    const window = `${startOfDay.toISOString()}/${endOfDay.toISOString()}`;

    return {
        context: {
          scope,
          timeZone: BUSINESS_TIME_ZONE,
          asOf,
          window,
          globalDataIncluded: includeGlobal,
        },
        metrics: {
          revenueToday: {
            value: revenueToday._sum.amount ?? 0,
            availability: "available" as const,
            scope,
            window,
            source: "booking_revenue.paidAt",
            asOf,
          },
          paidBookingsToday: {
            value: bookingsToday,
            availability: "available" as const,
            scope,
            window,
            source: "booking_revenue.paidAt",
            asOf,
            warning: "Đây là số giao dịch doanh thu đã ghi nhận, không phải tổng lịch hẹn.",
          },
          leadsToday: {
            value: leadsTodayCount,
            availability: "available" as const,
            scope,
            window,
            source: "lead.createdAt",
            asOf,
          },
          unreadMessages: {
            value: unreadMessages,
            availability: "available" as const,
            scope,
            window: "current_snapshot",
            source: "inbox_message.isRead",
            asOf,
            warning: "Chưa đọc không đồng nghĩa chưa được phản hồi.",
          },
        },
        setup: {
          completed: completedSetupSteps,
          total: setupSteps.length,
          complete: completedSetupSteps === setupSteps.length,
          steps: setupSteps,
        },
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
          criticalTasks: queueTotals.critical,
          queueTotal: queueTotals.total,
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
          scheduledToday: scheduledTodayCount,
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
          failedJobs: failedJobCount,
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
          alerts: openAlertCount,
          scheduledToday: scheduledTodayCount,
          failedJobs: failedJobCount,
        },
    };
}

export type TodayData = Awaited<ReturnType<typeof getTodayData>>;
