import "server-only";

import { adsReadinessBlockReason } from "@/lib/ads-readiness-policy";
import { evaluateAdsMutation } from "@/lib/ads-safety";
import { prisma } from "@/lib/db";
import { getAdsSettings } from "@/lib/settings/ads";
import { getBusinessDayRange } from "@/lib/today-policy";

export interface AutomationOperationsProvenance {
  scope: "account";
  source: string;
  asOf: string;
  warning: string;
}

export interface AutomationOperationsApproval {
  id: string;
  type: string;
  payload: string;
  shortCode: string;
  timeoutAt: string;
  createdAt: string;
}

export interface AutomationOperationsAdLog {
  id: string;
  campaignId: string;
  campaignName: string;
  action: string;
  reason: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
}

export interface AutomationOperationsConversation {
  id: string;
  senderId: string;
  facebookPageId: string | null;
  step: number;
  collectedName: string | null;
  collectedService: string | null;
  updatedAt: string;
  lead: { name: string; phone: string | null };
}

export interface AutomationOperationsNurtureLead {
  id: string;
  name: string;
  service: string | null;
  channelType: string | null;
  nurtureStep: number;
  nurtureSentAt: string | null;
  createdAt: string;
  due: boolean;
}

export interface AutomationOperationsJob {
  id: string;
  status: string;
  trigger: string;
  summary: string | null;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface AutomationOperationsAdsPage {
  id: string;
  pageName: string;
  adAccountId: string | null;
  readinessStatus: string;
  readinessCheckedAt: string | null;
  accountStatus: number | null;
  currency: string | null;
  timezone: string | null;
  blocker: string | null;
  pageAllowlisted: boolean;
  adAccountAllowlisted: boolean;
  writeBlocker: string | null;
}

export async function getAutomationOperationsData(now = new Date()) {
  const businessDay = getBusinessDayRange(now);
  const [approvals, adLogs, adLogsCountToday, spaSync, leadConversations, nurtureLeads, adsJobs, settings, adsPages, adsPolicy] = await Promise.all([
    prisma.pendingApproval.findMany({
      where: { status: "pending", timeoutAt: { gt: now } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, type: true, payload: true, shortCode: true, timeoutAt: true, createdAt: true },
    }),
    prisma.adOptimizationLog.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.adOptimizationLog.count({ where: { createdAt: { gte: businessDay.start, lte: businessDay.end } } }),
    prisma.spaSync.findUnique({ where: { id: "1" } }),
    prisma.leadConversation.findMany({
      where: { isComplete: false },
      select: {
        id: true,
        senderId: true,
        facebookPageId: true,
        step: true,
        collectedName: true,
        collectedService: true,
        updatedAt: true,
        lead: { select: { name: true, phone: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    prisma.lead.findMany({
      where: { handoffAt: null, nurtureStep: { lt: 3 }, channelId: { not: null } },
      select: { id: true, name: true, service: true, channelType: true, nurtureStep: true, nurtureSentAt: true, createdAt: true },
      orderBy: { nurtureSentAt: "asc" },
      take: 20,
    }),
    prisma.jobRun.findMany({
      where: { name: "ads_optimize" },
      orderBy: { startedAt: "desc" },
      take: 10,
      select: { id: true, status: true, trigger: true, summary: true, error: true, startedAt: true, completedAt: true },
    }),
    prisma.settings.findUnique({ where: { id: "1" }, select: { spaApiUrl: true, zaloApprovalRecipient: true } }),
    prisma.facebookPage.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        pageName: true,
        adAccountId: true,
        adsReadinessStatus: true,
        adsReadinessError: true,
        adsReadinessCheckedAt: true,
        adAccountStatus: true,
        adAccountCurrency: true,
        adAccountTimezone: true,
      },
    }),
    getAdsSettings(),
  ]);

  const serializedNurture = nurtureLeads.map((lead): AutomationOperationsNurtureLead => {
    const delayDays = [1, 3, 7][lead.nurtureStep] ?? 7;
    const threshold = new Date(now.getTime() - delayDays * 24 * 60 * 60 * 1000);
    return {
      ...lead,
      nurtureSentAt: lead.nurtureSentAt?.toISOString() ?? null,
      createdAt: lead.createdAt.toISOString(),
      due: (lead.nurtureSentAt ?? lead.createdAt) <= threshold,
    };
  });

  const pages = adsPages.map((page): AutomationOperationsAdsPage => {
    const readinessBlocker = page.adAccountId ? adsReadinessBlockReason(page, now) : "Chưa cấu hình Ad Account ID";
    const decision = evaluateAdsMutation({
      operation: "create_ad",
      facebookPageId: page.id,
      adAccountId: page.adAccountId ?? undefined,
    });
    const normalizedAccountId = page.adAccountId?.replace(/^act_/, "") ?? null;
    const adAccountAllowlisted = Boolean(normalizedAccountId && adsPolicy.allowedAdAccountIds.some((id) => id.replace(/^act_/, "") === normalizedAccountId));
    return {
      id: page.id,
      pageName: page.pageName,
      adAccountId: page.adAccountId,
      readinessStatus: page.adsReadinessStatus,
      readinessCheckedAt: page.adsReadinessCheckedAt?.toISOString() ?? null,
      accountStatus: page.adAccountStatus,
      currency: page.adAccountCurrency,
      timezone: page.adAccountTimezone,
      blocker: readinessBlocker,
      pageAllowlisted: adsPolicy.allowedFacebookPageIds.includes(page.id),
      adAccountAllowlisted,
      writeBlocker: readinessBlocker ?? (decision.allowed ? null : decision.reason),
    };
  });

  return {
    provenance: {
      scope: "account" as const,
      source: "PendingApproval, AdOptimizationLog, SpaSync, LeadConversation, Lead, JobRun, FacebookPage và Settings persisted",
      asOf: now.toISOString(),
      warning: "Đọc Operations không gọi Meta/Spa, không chạy Ads optimization và không cập nhật record. Readiness là snapshot persisted.",
    },
    approvals: approvals.map((approval): AutomationOperationsApproval => ({
      ...approval,
      timeoutAt: approval.timeoutAt.toISOString(),
      createdAt: approval.createdAt.toISOString(),
    })),
    adLogs: adLogs.map((log): AutomationOperationsAdLog => ({ ...log, createdAt: log.createdAt.toISOString() })),
    adLogsCountToday,
    spa: {
      configured: Boolean(settings?.spaApiUrl?.trim()),
      sync: spaSync ? {
        ...spaSync,
        lastSyncAt: spaSync.lastSyncAt?.toISOString() ?? null,
        lastPublishRun: spaSync.lastPublishRun?.toISOString() ?? null,
        lastAdsOptRun: spaSync.lastAdsOptRun?.toISOString() ?? null,
        updatedAt: spaSync.updatedAt.toISOString(),
      } : null,
    },
    leadConversations: leadConversations.map((conversation): AutomationOperationsConversation => ({
      ...conversation,
      updatedAt: conversation.updatedAt.toISOString(),
    })),
    nurtureLeads: serializedNurture,
    nurtureDueCount: serializedNurture.filter((lead) => lead.due).length,
    adsJobs: adsJobs.map((job): AutomationOperationsJob => ({
      ...job,
      startedAt: job.startedAt.toISOString(),
      completedAt: job.completedAt?.toISOString() ?? null,
    })),
    ads: {
      policy: {
        executionMode: adsPolicy.executionMode,
        emergencyStop: adsPolicy.emergencyStop,
        requestedAutomationLevel: adsPolicy.requestedAutomationLevel,
        effectiveAutomationLevel: adsPolicy.effectiveAutomationLevel,
        forcedDryRun: adsPolicy.forcedDryRun,
        pauseCtr: adsPolicy.adsOptimizePauseCtr,
        scaleCtr: adsPolicy.adsOptimizeScaleCtr,
        minRoas: adsPolicy.adsOptimizeMinRoas,
        maxBudget: adsPolicy.adsOptimizeMaxBudget,
        cooldownHours: adsPolicy.adsOptimizeCooldownHrs,
        hasApprovalRecipient: Boolean(settings?.zaloApprovalRecipient?.trim()),
      },
      configuredPageCount: pages.filter((page) => page.adAccountId).length,
      readyPageCount: pages.filter((page) => page.writeBlocker === null).length,
      pages,
    },
  };
}
