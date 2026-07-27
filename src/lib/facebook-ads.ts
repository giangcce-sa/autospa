import { randomUUID } from "node:crypto";
import { logActivity } from "./activity-log";
import { adsCreateRequestHash, assertAdsCreateRequestMatches } from "./ads-create-policy";
import { buildAdPayload, buildAdSetPayload, buildCampaignPayload } from "./ads-create-payloads";
import { runAdsCreateWorkflow } from "./ads-create-workflow";
import { loadAdsImage } from "./ads-media";
import { assertAdsReadiness } from "./ads-readiness";
import {
  budgetTargetBelongsToCampaign,
  campaignBelongsToAdAccount,
  normalizeMetaAdAccountId,
} from "./ads-ownership";
import { enforceAdsMutation } from "./ads-safety";
import { prisma } from "./db";
import { decryptSecret } from "./secrets-crypto";
import { sanitizeMetaPagingUrl } from "./meta-graph-url";
import { AccessError } from "./page-access";

const FB = "https://graph.facebook.com/v21.0";

type AdsCreds = {
  token: string;
  actId: string;
  pageId: string;
  facebookPageId: string;
  adAccountId: string;
};

async function getAdsCreds(facebookPageId?: string): Promise<AdsCreds> {
  if (!facebookPageId) throw new Error("Thao tác quảng cáo yêu cầu Facebook Page cụ thể");
  const page = await prisma.facebookPage.findUnique({ where: { id: facebookPageId } });
  if (!page) throw new Error("Chưa cấu hình Facebook Page");
  if (!page.adAccountId) throw new Error("Chưa cấu hình Ad Account ID — vào Cài đặt → Facebook Page để thêm");
  const actId = page.adAccountId.startsWith("act_") ? page.adAccountId : `act_${page.adAccountId}`;
  const token = decryptSecret(page.accessToken);
  if (!token) throw new Error("Access Token của Facebook Page không đọc được — nhập lại trong Cài đặt");
  return {
    token,
    actId,
    pageId: page.fbPageId,
    facebookPageId: page.id,
    adAccountId: page.adAccountId,
  };
}

async function getAdsWriteCreds(facebookPageId?: string) {
  return getAdsCreds(facebookPageId);
}

function detectAdsError(data: { error?: { message: string; code?: number } }) {
  if (!data.error) return;
  throw new Error(data.error.message);
}

async function readGraphObject<T>(objectId: string, fields: string, token: string): Promise<T> {
  const url = new URL(`${FB}/${objectId}`);
  url.searchParams.set("fields", fields);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json() as T & { error?: { message: string; code?: number } };
  detectAdsError(data);
  return data;
}

async function assertCampaignOwnership(campaignId: string, creds: AdsCreds) {
  const campaign = await readGraphObject<{ id?: string; account_id?: string }>(
    campaignId,
    "id,account_id",
    creds.token,
  );
  if (!campaignBelongsToAdAccount(campaign, creds.adAccountId)) {
    throw new AccessError("Campaign không thuộc Ad Account đã chọn", 403);
  }
}

async function assertBudgetTargetOwnership(input: {
  campaignId: string;
  targetId: string;
  targetType: "campaign" | "adset";
  creds: AdsCreds;
}) {
  await assertCampaignOwnership(input.campaignId, input.creds);
  if (input.targetType === "campaign") {
    if (!budgetTargetBelongsToCampaign({
      campaignId: input.campaignId,
      targetId: input.targetId,
      targetType: input.targetType,
      adAccountId: input.creds.adAccountId,
    })) {
      throw new AccessError("Budget target không khớp Campaign", 403);
    }
    return;
  }

  const adSet = await readGraphObject<{ id?: string; account_id?: string; campaign_id?: string }>(
    input.targetId,
    "id,account_id,campaign_id",
    input.creds.token,
  );
  if (!budgetTargetBelongsToCampaign({
    campaignId: input.campaignId,
    targetId: input.targetId,
    targetType: input.targetType,
    adSet,
    adAccountId: input.creds.adAccountId,
  })) {
    throw new AccessError("Ad Set không thuộc Campaign và Ad Account đã chọn", 403);
  }
}

export interface Campaign {
  id: string;
  name: string;
  status: string;
  objective: string;
  facebookPageId: string;
  adAccountId: string;
  dailyBudget?: string;
  lifetimeBudget?: string;
  spend?: string;
  reach?: string;
  clicks?: string;
  impressions?: string;
  ctr?: string;
  startTime?: string;
  stopTime?: string;
  budgetTarget?: { id: string; type: "campaign" | "adset"; dailyBudget: string };
  budgetIssue?: string;
}

export async function getCampaigns(facebookPageId?: string): Promise<Campaign[]> {
  const { token, actId, facebookPageId: resolvedFacebookPageId, adAccountId } = await getAdsCreds(facebookPageId);
  const fields = "id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time,insights.date_preset(last_7d){spend,reach,clicks,impressions,ctr}";
  const campaigns: Array<{
    id: string; name: string; status: string; objective: string;
    daily_budget?: string; lifetime_budget?: string; start_time?: string; stop_time?: string;
    insights?: { data?: Array<{ spend?: string; reach?: string; clicks?: string; impressions?: string; ctr?: string }> };
  }> = [];
  let nextUrl: string | null = `${FB}/${actId}/campaigns?fields=${fields}&limit=100`;
  while (nextUrl) {
    const res: Response = await fetch(nextUrl, { headers: { Authorization: `Bearer ${token}` } });
    const data: { data?: typeof campaigns; paging?: { next?: string }; error?: { message: string; code?: number } } = await res.json();
    detectAdsError(data);
    campaigns.push(...(data.data ?? []));
    nextUrl = sanitizeMetaPagingUrl(data.paging?.next);
  }

  const adSetFields = "id,campaign_id,effective_status,daily_budget";
  const adSets: Array<{ id: string; campaign_id: string; effective_status: string; daily_budget?: string }> = [];
  nextUrl = `${FB}/${actId}/adsets?fields=${adSetFields}&limit=100`;
  while (nextUrl) {
    const res: Response = await fetch(nextUrl, { headers: { Authorization: `Bearer ${token}` } });
    const data: { data?: typeof adSets; paging?: { next?: string }; error?: { message: string; code?: number } } = await res.json();
    detectAdsError(data);
    adSets.push(...(data.data ?? []));
    nextUrl = sanitizeMetaPagingUrl(data.paging?.next);
  }

  return campaigns.map((c) => {
    const ins = c.insights?.data?.[0] ?? {};
    const campaignAdSets = adSets.filter(
      (adSet) => adSet.campaign_id === c.id && adSet.effective_status === "ACTIVE" && Number(adSet.daily_budget) > 0,
    );
    const budgetTarget = c.daily_budget
      ? { id: c.id, type: "campaign" as const, dailyBudget: c.daily_budget }
      : campaignAdSets.length === 1
        ? { id: campaignAdSets[0].id, type: "adset" as const, dailyBudget: campaignAdSets[0].daily_budget! }
        : undefined;
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      objective: c.objective,
      facebookPageId: resolvedFacebookPageId,
      adAccountId,
      dailyBudget: c.daily_budget,
      lifetimeBudget: c.lifetime_budget,
      startTime: c.start_time,
      stopTime: c.stop_time,
      spend: ins.spend,
      reach: ins.reach,
      clicks: ins.clicks,
      impressions: ins.impressions,
      ctr: ins.ctr,
      budgetTarget,
      budgetIssue: budgetTarget
        ? undefined
        : campaignAdSets.length > 1
          ? "Campaign có nhiều Ad Set đang đặt ngân sách"
          : "Không tìm thấy ngân sách ngày ở Campaign hoặc Ad Set",
    };
  });
}

export interface AdsInsights {
  spend: string;
  reach: string;
  impressions: string;
  clicks: string;
  ctr: string;
  cpm: string;
  cpc: string;
  campaigns: Array<{ name: string; spend: string; reach: string; clicks: string; impressions: string; ctr: string }>;
}

export async function getInsights(facebookPageId?: string, datePreset = "last_7d"): Promise<AdsInsights> {
  const { token, actId } = await getAdsCreds(facebookPageId);
  const fields = "spend,reach,impressions,clicks,ctr,cpm,cpc";
  const url = `${FB}/${actId}/insights?fields=${fields}&date_preset=${datePreset}&level=account`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  detectAdsError(data);
  const acc = data.data?.[0] ?? {};

  const campUrl = `${FB}/${actId}/insights?fields=${fields},campaign_name&date_preset=${datePreset}&level=campaign&limit=20`;
  const campRes = await fetch(campUrl, { headers: { Authorization: `Bearer ${token}` } });
  const campData = await campRes.json();
  const camps = (campData.data ?? []).map((c: {
    campaign_name?: string; spend?: string; reach?: string; clicks?: string; impressions?: string; ctr?: string;
  }) => ({
    name: c.campaign_name ?? "",
    spend: c.spend ?? "0",
    reach: c.reach ?? "0",
    clicks: c.clicks ?? "0",
    impressions: c.impressions ?? "0",
    ctr: c.ctr ?? "0",
  }));

  return {
    spend: acc.spend ?? "0",
    reach: acc.reach ?? "0",
    impressions: acc.impressions ?? "0",
    clicks: acc.clicks ?? "0",
    ctr: acc.ctr ?? "0",
    cpm: acc.cpm ?? "0",
    cpc: acc.cpc ?? "0",
    campaigns: camps,
  };
}

export async function setCampaignStatus(fbCampaignId: string, status: "ACTIVE" | "PAUSED", facebookPageId?: string): Promise<void> {
  const creds = await getAdsWriteCreds(facebookPageId);
  await enforceAdsMutation({
    operation: status === "ACTIVE" ? "resume_campaign" : "pause_campaign",
    facebookPageId: creds.facebookPageId,
    adAccountId: creds.adAccountId,
  });
  await assertAdsReadiness(creds.facebookPageId, creds.adAccountId);
  await assertCampaignOwnership(fbCampaignId, creds);
  const res = await fetch(`${FB}/${fbCampaignId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${creds.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });
  const data = await res.json();
  detectAdsError(data);
}

export async function updateAdsBudget(input: {
  campaignId: string;
  targetId: string;
  targetType: "campaign" | "adset";
  dailyBudgetVnd: number;
  facebookPageId?: string;
}): Promise<void> {
  const creds = await getAdsWriteCreds(input.facebookPageId);
  await enforceAdsMutation({
    operation: "update_ads_budget",
    facebookPageId: creds.facebookPageId,
    adAccountId: creds.adAccountId,
  });
  await assertAdsReadiness(creds.facebookPageId, creds.adAccountId);
  await assertBudgetTargetOwnership({
    campaignId: input.campaignId,
    targetId: input.targetId,
    targetType: input.targetType,
    creds,
  });
  const res = await fetch(`${FB}/${input.targetId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${creds.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ daily_budget: String(input.dailyBudgetVnd) }),
  });
  const data = await res.json();
  detectAdsError(data);
}

export interface CreateAdParams {
  idempotencyKey: string;
  postId: string;
  actorId: string;
  name: string;
  message: string;
  imageUrl: string;
  targetAgeMin: number;
  targetAgeMax: number;
  targetGenders: Array<1 | 2>;
  targetCountry: string;
  dailyBudgetVnd: number;
  startTime?: string;
  endTime?: string;
  objective: "OUTCOME_AWARENESS";
  facebookPageId: string;
}

export type CreateAdResult = {
  operationId: string;
  campaignId: string;
  adSetId: string;
  creativeId: string;
  adId: string;
  status: "completed";
  reused: boolean;
};

type GraphObject = { id?: string; name?: string; account_id?: string; campaign_id?: string; adset_id?: string };
type GraphList = { data?: GraphObject[]; error?: { message: string; code?: number } };

function createRequestHash(params: CreateAdParams, adAccountId: string) {
  return adsCreateRequestHash({
    postId: params.postId,
    facebookPageId: params.facebookPageId,
    adAccountId: normalizeMetaAdAccountId(adAccountId),
    name: params.name,
    message: params.message,
    imageUrl: params.imageUrl,
    targetAgeMin: params.targetAgeMin,
    targetAgeMax: params.targetAgeMax,
    targetGenders: params.targetGenders,
    targetCountry: params.targetCountry,
    dailyBudgetVnd: params.dailyBudgetVnd,
    startTime: params.startTime ?? null,
    endTime: params.endTime ?? null,
    objective: params.objective,
  });
}

function requireGraphId(data: { id?: string }, step: string) {
  if (!data.id) throw new Error(`Meta không trả về ID cho ${step}`);
  return data.id;
}

async function createGraphObject(input: {
  path: string;
  token: string;
  body: Record<string, unknown>;
  step: string;
}) {
  const response = await fetch(`${FB}/${input.path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input.body),
  });
  const data = await response.json() as { id?: string; error?: { message: string; code?: number } };
  detectAdsError(data);
  return requireGraphId(data, input.step);
}

async function findGraphObject(input: {
  path: string;
  fields: string;
  token: string;
  name: string;
  belongs: (item: GraphObject) => boolean;
}) {
  let nextUrl: string | null = `${FB}/${input.path}?fields=${input.fields}&limit=100`;
  while (nextUrl) {
    const response: Response = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${input.token}` },
    });
    const data = await response.json() as GraphList & { paging?: { next?: string } };
    detectAdsError(data);
    const match = (data.data ?? []).find((item) => item.name === input.name && input.belongs(item));
    if (match?.id) return match.id;
    nextUrl = sanitizeMetaPagingUrl(data.paging?.next);
  }
  return null;
}

function operationName(baseName: string, operationId: string, suffix: string) {
  return `${baseName} [autospa:${operationId}]${suffix}`;
}

async function getOrCreateOperation(params: CreateAdParams, creds: AdsCreds, requestHash: string) {
  try {
    return await prisma.adsCreateOperation.create({
      data: {
        idempotencyKey: params.idempotencyKey,
        requestHash,
        postId: params.postId,
        facebookPageId: creds.facebookPageId,
        fbPageId: creds.pageId,
        adAccountId: normalizeMetaAdAccountId(creds.adAccountId),
        currency: "VND",
        actorId: params.actorId,
        input: JSON.stringify(params),
      },
    });
  } catch (error) {
    const existing = await prisma.adsCreateOperation.findUnique({
      where: { idempotencyKey: params.idempotencyKey },
    });
    if (!existing) throw error;
    try {
      assertAdsCreateRequestMatches(existing.requestHash, requestHash);
    } catch {
      throw new AccessError("Idempotency key đã được dùng cho yêu cầu khác", 409);
    }
    return existing;
  }
}

export async function reconcileAdsCreateOperations(limit = 10) {
  const operations = await prisma.adsCreateOperation.findMany({
    where: {
      attempt: { lt: 3 },
      OR: [
        { status: "failed" },
        { status: "executing", leaseUntil: { lt: new Date() } },
      ],
    },
    orderBy: { updatedAt: "asc" },
    take: Math.min(Math.max(limit, 1), 20),
    select: { id: true, input: true },
  });
  const results: Array<{ operationId: string; status: "completed" | "failed"; error?: string }> = [];
  for (const operation of operations) {
    let params: CreateAdParams;
    try {
      params = JSON.parse(operation.input) as CreateAdParams;
    } catch {
      await prisma.adsCreateOperation.update({
        where: { id: operation.id },
        data: { status: "needs_attention", error: "Ads operation input không hợp lệ" },
      });
      results.push({ operationId: operation.id, status: "failed", error: "Ads operation input không hợp lệ" });
      continue;
    }
    try {
      await createFullAd(params);
      results.push({ operationId: operation.id, status: "completed" });
    } catch (error) {
      results.push({
        operationId: operation.id,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return results;
}

export async function createFullAd(params: CreateAdParams): Promise<CreateAdResult> {
  const creds = await getAdsWriteCreds(params.facebookPageId);
  await enforceAdsMutation({
    operation: "create_ad",
    facebookPageId: creds.facebookPageId,
    adAccountId: creds.adAccountId,
  });
  const readiness = await assertAdsReadiness(creds.facebookPageId, creds.adAccountId);
  const requestHash = createRequestHash(params, creds.adAccountId);
  let operation = await getOrCreateOperation(params, creds, requestHash);

  if (operation.status === "completed" && operation.campaignId && operation.adSetId && operation.creativeId && operation.adId) {
    return {
      operationId: operation.id,
      campaignId: operation.campaignId,
      adSetId: operation.adSetId,
      creativeId: operation.creativeId,
      adId: operation.adId,
      status: "completed",
      reused: true,
    };
  }

  const isRetry = operation.attempt > 0 || operation.status === "failed";
  const leaseOwner = randomUUID();
  const claimed = await prisma.adsCreateOperation.updateMany({
    where: {
      id: operation.id,
      status: { not: "completed" },
      OR: [
        { leaseUntil: null },
        { leaseUntil: { lt: new Date() } },
      ],
    },
    data: {
      status: "executing",
      leaseOwner,
      leaseUntil: new Date(Date.now() + 10 * 60_000),
      attempt: { increment: 1 },
      error: null,
    },
  });
  if (!claimed.count) throw new AccessError("Yêu cầu tạo quảng cáo đang được xử lý", 409);

  operation = await prisma.adsCreateOperation.findUniqueOrThrow({ where: { id: operation.id } });
  let adImage: Awaited<ReturnType<typeof loadAdsImage>>;
  try {
    adImage = await loadAdsImage(params.imageUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.adsCreateOperation.updateMany({
      where: { id: operation.id, leaseOwner },
      data: {
        status: "failed",
        currentStep: "media_preflight",
        error: message,
        leaseOwner: null,
        leaseUntil: null,
      },
    });
    throw error;
  }
  const campaignName = operationName(params.name, operation.id, "");
  const adSetName = operationName(params.name, operation.id, " - AdSet");
  const creativeName = operationName(params.name, operation.id, " - Creative");
  const adName = operationName(params.name, operation.id, " - Ad");
  const { token, actId, pageId } = creds;

  try {
    const result = await runAdsCreateWorkflow({
      state: operation,
      requiresImage: true,
      checkpoint: async (field, value, nextStep) => {
        await prisma.adsCreateOperation.update({
          where: { id: operation.id, leaseOwner },
          data: {
            [field]: value,
            currentStep: nextStep,
            leaseUntil: new Date(Date.now() + 10 * 60_000),
          },
        });
      },
      createCampaign: async () => {
        const recovered = await findGraphObject({
          path: `${actId}/campaigns`,
          fields: "id,name,account_id",
          token,
          name: campaignName,
          belongs: (item) => campaignBelongsToAdAccount(item, creds.adAccountId),
        });
        return recovered ?? createGraphObject({
          path: `${actId}/campaigns`,
          token,
          step: "Campaign",
          body: buildCampaignPayload(campaignName, params.objective),
        });
      },
      createAdSet: async (campaignId) => {
        const recovered = await findGraphObject({
          path: `${actId}/adsets`,
          fields: "id,name,account_id,campaign_id",
          token,
          name: adSetName,
          belongs: (item) => item.campaign_id === campaignId && campaignBelongsToAdAccount(item, creds.adAccountId),
        });
        const body = buildAdSetPayload({
          name: adSetName,
          campaignId,
          dailyBudgetVnd: params.dailyBudgetVnd,
          targetCountry: "VN",
          targetAgeMin: params.targetAgeMin,
          targetAgeMax: params.targetAgeMax,
          targetGenders: params.targetGenders,
          objective: params.objective,
          startTime: params.startTime,
          endTime: params.endTime,
        });
        return recovered ?? createGraphObject({ path: `${actId}/adsets`, token, body, step: "Ad Set" });
      },
      uploadImage: async () => {
        const form = new FormData();
        form.append("source", new Blob([Uint8Array.from(adImage.buffer)], { type: adImage.mimeType }), "autospa-ad-image");
        const response = await fetch(`${FB}/${actId}/adimages`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
        const data = await response.json() as {
          images?: Record<string, { hash?: string }>;
          error?: { message: string; code?: number };
        };
        detectAdsError(data);
        const hash = Object.values(data.images ?? {})[0]?.hash;
        if (!hash) throw new Error("Meta không trả về image hash");
        return hash;
      },
      createCreative: async (imageHash) => {
        const recovered = await findGraphObject({
          path: `${actId}/adcreatives`,
          fields: "id,name,account_id",
          token,
          name: creativeName,
          belongs: (item) => campaignBelongsToAdAccount(item, creds.adAccountId),
        });
        return recovered ?? createGraphObject({
          path: `${actId}/adcreatives`,
          token,
          step: "Creative",
          body: {
            name: creativeName,
            object_story_spec: {
              page_id: pageId,
              link_data: {
                message: params.message,
                link: `https://www.facebook.com/${pageId}`,
                image_hash: imageHash,
              },
            },
          },
        });
      },
      createAd: async (adSetId, creativeId) => {
        const recovered = await findGraphObject({
          path: `${actId}/ads`,
          fields: "id,name,account_id,adset_id",
          token,
          name: adName,
          belongs: (item) => item.adset_id === adSetId && campaignBelongsToAdAccount(item, creds.adAccountId),
        });
        return recovered ?? createGraphObject({
          path: `${actId}/ads`,
          token,
          step: "Ad",
          body: buildAdPayload(adName, adSetId, creativeId),
        });
      },
    });

    await prisma.$transaction([
      prisma.post.update({
        where: { id: params.postId },
        data: { fbCampaignId: result.campaignId, fbAdId: result.adId },
      }),
      prisma.adsCreateOperation.update({
        where: { id: operation.id, leaseOwner },
        data: {
          status: "completed",
          currentStep: "complete",
          campaignId: result.campaignId,
          adSetId: result.adSetId,
          imageHash: result.imageHash,
          creativeId: result.creativeId,
          adId: result.adId,
          completedAt: new Date(),
          reconciledAt: isRetry ? new Date() : null,
          leaseOwner: null,
          leaseUntil: null,
          error: null,
        },
      }),
    ]);
    await logActivity({
      type: "ads_create_completed",
      title: "Đã tạo bộ quảng cáo PAUSED",
      severity: "success",
      source: "facebook_ads",
      metadata: {
        operationId: operation.id,
        facebookPageId: creds.facebookPageId,
        adAccountId: normalizeMetaAdAccountId(creds.adAccountId),
        currency: readiness.adAccountCurrency,
        actorId: params.actorId,
        campaignId: result.campaignId,
        adSetId: result.adSetId,
        creativeId: result.creativeId,
        adId: result.adId,
      },
    }).catch(() => null);
    return { operationId: operation.id, ...result, status: "completed", reused: isRetry };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.adsCreateOperation.updateMany({
      where: { id: operation.id, leaseOwner },
      data: { status: "failed", error: message, leaseOwner: null, leaseUntil: null },
    }).catch(() => null);
    await logActivity({
      type: "ads_create_failed",
      title: "Tạo quảng cáo PAUSED thất bại",
      detail: message,
      severity: "danger",
      source: "facebook_ads",
      metadata: {
        operationId: operation.id,
        facebookPageId: creds.facebookPageId,
        adAccountId: normalizeMetaAdAccountId(creds.adAccountId),
        actorId: params.actorId,
      },
    }).catch(() => null);
    throw error;
  }
}
