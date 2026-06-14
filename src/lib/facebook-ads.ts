import { prisma } from "./db";

const FB = "https://graph.facebook.com/v21.0";

type AdsCreds = { token: string; actId: string; pageId: string };

async function getAdsCreds(facebookPageId?: string): Promise<AdsCreds> {
  const page = facebookPageId
    ? await prisma.facebookPage.findUnique({ where: { id: facebookPageId } })
    : await prisma.facebookPage.findFirst({ where: { isActive: true } });
  if (!page) throw new Error("Chưa cấu hình Facebook Page");
  if (!page.adAccountId) throw new Error("Chưa cấu hình Ad Account ID — vào Cài đặt → Facebook Page để thêm");
  const actId = page.adAccountId.startsWith("act_") ? page.adAccountId : `act_${page.adAccountId}`;
  return { token: page.accessToken, actId, pageId: page.fbPageId };
}

function detectAdsError(data: { error?: { message: string; code?: number } }) {
  if (!data.error) return;
  throw new Error(data.error.message);
}

export interface Campaign {
  id: string;
  name: string;
  status: string;
  objective: string;
  dailyBudget?: string;
  lifetimeBudget?: string;
  spend?: string;
  reach?: string;
  clicks?: string;
  impressions?: string;
  ctr?: string;
  startTime?: string;
  stopTime?: string;
}

export async function getCampaigns(facebookPageId?: string): Promise<Campaign[]> {
  const { token, actId } = await getAdsCreds(facebookPageId);
  const fields = "id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time,insights{spend,reach,clicks,impressions,ctr}";
  const url = `${FB}/${actId}/campaigns?fields=${fields}&limit=50&access_token=${token}`;
  const res = await fetch(url);
  const data = await res.json();
  detectAdsError(data);
  return (data.data ?? []).map((c: {
    id: string; name: string; status: string; objective: string;
    daily_budget?: string; lifetime_budget?: string; start_time?: string; stop_time?: string;
    insights?: { data?: Array<{ spend?: string; reach?: string; clicks?: string; impressions?: string; ctr?: string }> };
  }) => {
    const ins = c.insights?.data?.[0] ?? {};
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      objective: c.objective,
      dailyBudget: c.daily_budget,
      lifetimeBudget: c.lifetime_budget,
      startTime: c.start_time,
      stopTime: c.stop_time,
      spend: ins.spend,
      reach: ins.reach,
      clicks: ins.clicks,
      impressions: ins.impressions,
      ctr: ins.ctr,
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
  const url = `${FB}/${actId}/insights?fields=${fields}&date_preset=${datePreset}&level=account&access_token=${token}`;
  const res = await fetch(url);
  const data = await res.json();
  detectAdsError(data);
  const acc = data.data?.[0] ?? {};

  const campUrl = `${FB}/${actId}/insights?fields=${fields},campaign_name&date_preset=${datePreset}&level=campaign&limit=20&access_token=${token}`;
  const campRes = await fetch(campUrl);
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
  const { token } = await getAdsCreds(facebookPageId);
  const res = await fetch(`${FB}/${fbCampaignId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, access_token: token }),
  });
  const data = await res.json();
  detectAdsError(data);
}

export async function updateCampaignBudget(fbCampaignId: string, dailyBudgetVnd: number, facebookPageId?: string): Promise<void> {
  const { token } = await getAdsCreds(facebookPageId);
  const res = await fetch(`${FB}/${fbCampaignId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ daily_budget: String(dailyBudgetVnd), access_token: token }),
  });
  const data = await res.json();
  detectAdsError(data);
}

export interface CreateAdParams {
  name: string;
  message: string;
  imageUrl?: string;
  targetAgeMin: number;
  targetAgeMax: number;
  targetGenders: number[];
  targetCountry: string;
  dailyBudgetVnd: number;
  startTime?: string;
  endTime?: string;
  objective?: string;
  facebookPageId?: string;
}

export async function createFullAd(params: CreateAdParams): Promise<{ campaignId: string; adId: string }> {
  const { token, actId, pageId } = await getAdsCreds(params.facebookPageId);
  const objective = params.objective ?? "OUTCOME_AWARENESS";

  // 1. Create campaign
  const campRes = await fetch(`${FB}/${actId}/campaigns`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: params.name,
      objective,
      status: "ACTIVE",
      special_ad_categories: [],
      access_token: token,
    }),
  });
  const campData = await campRes.json();
  detectAdsError(campData);
  const campaignId = campData.id;

  // 2. Create adset
  const targeting: Record<string, unknown> = {
    geo_locations: { countries: [params.targetCountry || "VN"] },
    age_min: params.targetAgeMin,
    age_max: params.targetAgeMax,
  };
  if (params.targetGenders.length > 0) targeting.genders = params.targetGenders;

  const adsetBody: Record<string, unknown> = {
    name: `${params.name} - AdSet`,
    campaign_id: campaignId,
    daily_budget: String(params.dailyBudgetVnd),
    billing_event: "IMPRESSIONS",
    optimization_goal: "REACH",
    targeting,
    status: "ACTIVE",
    access_token: token,
  };
  if (params.startTime) adsetBody.start_time = params.startTime;
  if (params.endTime) adsetBody.end_time = params.endTime;

  const adsetRes = await fetch(`${FB}/${actId}/adsets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(adsetBody),
  });
  const adsetData = await adsetRes.json();
  detectAdsError(adsetData);
  const adsetId = adsetData.id;

  // 3. Upload image if provided
  let imageHash: string | undefined;
  if (params.imageUrl) {
    const formData = new FormData();
    if (params.imageUrl.startsWith("data:")) {
      const [header, b64] = params.imageUrl.split(",");
      const mimeType = header.match(/data:([^;]+)/)?.[1] ?? "image/png";
      const buffer = Buffer.from(b64, "base64");
      formData.append("source", new Blob([buffer], { type: mimeType }), "image.png");
    } else {
      const imgRes = await fetch(params.imageUrl);
      if (imgRes.ok) formData.append("source", await imgRes.blob(), "image.png");
    }
    formData.append("access_token", token);
    const imgUpRes = await fetch(`${FB}/${actId}/adimages`, { method: "POST", body: formData });
    const imgUpData = await imgUpRes.json();
    if (imgUpData.images) {
      const keys = Object.keys(imgUpData.images);
      imageHash = imgUpData.images[keys[0]]?.hash;
    }
  }

  // 4. Create creative
  const storySpec: Record<string, unknown> = {
    page_id: pageId,
    link_data: { message: params.message, link: `https://www.facebook.com/${pageId}` },
  };
  if (imageHash) {
    (storySpec.link_data as Record<string, unknown>).image_hash = imageHash;
  }

  const creativeRes = await fetch(`${FB}/${actId}/adcreatives`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: `${params.name} - Creative`,
      object_story_spec: storySpec,
      access_token: token,
    }),
  });
  const creativeData = await creativeRes.json();
  detectAdsError(creativeData);
  const creativeId = creativeData.id;

  // 5. Create ad
  const adRes = await fetch(`${FB}/${actId}/ads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: `${params.name} - Ad`,
      adset_id: adsetId,
      creative: { creative_id: creativeId },
      status: "ACTIVE",
      access_token: token,
    }),
  });
  const adData = await adRes.json();
  detectAdsError(adData);

  return { campaignId, adId: adData.id };
}
