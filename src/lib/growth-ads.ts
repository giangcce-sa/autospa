import "server-only";

import { adsReadinessBlockReason } from "@/lib/ads-readiness-policy";
import { evaluateAdsMutation } from "@/lib/ads-safety";
import { prisma } from "@/lib/db";
import { getCampaigns, getInsights, type AdsInsights, type Campaign } from "@/lib/facebook-ads";
import { AccessError } from "@/lib/page-access";
import { getAdsSettings } from "@/lib/settings/ads";

export interface AdsWorkspaceContextData {
  page: {
    id: string;
    pageName: string;
    adAccountId: string | null;
  };
  readiness: {
    status: string;
    checkedAt: string | null;
    accountStatus: number | null;
    currency: string | null;
    timezone: string | null;
    blocker: string | null;
  };
  policy: {
    executionMode: "read_only" | "supervised_manual" | "semi" | "full";
    emergencyStop: boolean;
    effectiveAutomationLevel: "supervised" | "semi" | "full";
    forcedDryRun: boolean;
    pageAllowlisted: boolean;
    adAccountAllowlisted: boolean;
    writeBlocker: string | null;
  };
}

export interface AdsDataResult<T> {
  value: T | null;
  availability: "available" | "unavailable";
  source: string;
  window: string;
  asOf: string;
  warning?: string;
}

export interface AdsOperationData {
  id: string;
  status: string;
  currentStep: string;
  attempt: number;
  campaignId: string | null;
  adSetId: string | null;
  creativeId: string | null;
  adId: string | null;
  error: string | null;
  completedAt: string | null;
  updatedAt: string;
}

export interface AdsDraftPostData {
  id: string;
  caption: string;
  hashtags: string | null;
  imageUrl: string | null;
  service: { name: string } | null;
  createdAt: string;
}

export async function getAdsWorkspaceContext(facebookPageId: string): Promise<AdsWorkspaceContextData> {
  const page = await prisma.facebookPage.findUnique({
    where: { id: facebookPageId },
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
  });
  if (!page) throw new AccessError("Facebook Page không tồn tại", 404);

  const settings = await getAdsSettings();
  const decision = evaluateAdsMutation({
    operation: "create_ad",
    facebookPageId: page.id,
    adAccountId: page.adAccountId ?? undefined,
  });
  const readinessBlocker = page.adAccountId ? adsReadinessBlockReason(page) : "Chưa cấu hình Ad Account ID";
  const normalizedAdAccountId = page.adAccountId?.replace(/^act_/, "") ?? null;
  const adAccountAllowlisted = Boolean(page.adAccountId && settings.allowedAdAccountIds.some((id) => id.replace(/^act_/, "") === normalizedAdAccountId));

  return {
    page: {
      id: page.id,
      pageName: page.pageName,
      adAccountId: page.adAccountId,
    },
    readiness: {
      status: page.adsReadinessStatus,
      checkedAt: page.adsReadinessCheckedAt?.toISOString() ?? null,
      accountStatus: page.adAccountStatus,
      currency: page.adAccountCurrency,
      timezone: page.adAccountTimezone,
      blocker: readinessBlocker,
    },
    policy: {
      executionMode: settings.executionMode,
      emergencyStop: settings.emergencyStop,
      effectiveAutomationLevel: settings.effectiveAutomationLevel,
      forcedDryRun: settings.forcedDryRun,
      pageAllowlisted: settings.allowedFacebookPageIds.includes(page.id),
      adAccountAllowlisted,
      writeBlocker: readinessBlocker ?? (decision.allowed ? null : decision.reason),
    },
  };
}

export async function getAdsCampaignData(facebookPageId: string): Promise<AdsDataResult<Campaign[]>> {
  return readMetaData(() => getCampaigns(facebookPageId), "Meta Marketing API", "7 ngày gần nhất");
}

export async function getAdsInsightsData(facebookPageId: string, datePreset: string): Promise<AdsDataResult<AdsInsights>> {
  return readMetaData(() => getInsights(facebookPageId, datePreset), "Meta Marketing API", datePreset);
}

export async function getAdsOperations(facebookPageId: string): Promise<AdsOperationData[]> {
  const operations = await prisma.adsCreateOperation.findMany({
    where: { facebookPageId },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      status: true,
      currentStep: true,
      attempt: true,
      campaignId: true,
      adSetId: true,
      creativeId: true,
      adId: true,
      error: true,
      completedAt: true,
      updatedAt: true,
    },
  });
  return operations.map((operation) => ({
    ...operation,
    completedAt: operation.completedAt?.toISOString() ?? null,
    updatedAt: operation.updatedAt.toISOString(),
  }));
}

export async function getAdsDraftPosts(facebookPageId: string): Promise<AdsDraftPostData[]> {
  const posts = await prisma.post.findMany({
    where: {
      facebookPageId,
      imageUrl: { not: null },
      review: { is: { status: "pass" } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      caption: true,
      hashtags: true,
      imageUrl: true,
      service: { select: { name: true } },
      createdAt: true,
    },
  });
  return posts.map((post) => ({ ...post, createdAt: post.createdAt.toISOString() }));
}

async function readMetaData<T>(reader: () => Promise<T>, source: string, window: string): Promise<AdsDataResult<T>> {
  const asOf = new Date().toISOString();
  try {
    return {
      value: await reader(),
      availability: "available",
      source,
      window,
      asOf,
    };
  } catch (error) {
    return {
      value: null,
      availability: "unavailable",
      source,
      window,
      asOf,
      warning: error instanceof Error ? error.message : String(error),
    };
  }
}
