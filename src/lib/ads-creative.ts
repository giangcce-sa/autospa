import { prisma } from "./db";
import { councilDebate, type CouncilResult } from "./ai-council";
import { generateContent } from "./claude";
import { getCompetitorContext } from "./learning/competitor-learning";
import {
  buildAdCreativeFallback,
  parseGeneratedAdSpecText,
  type AdCreativeEstimateSource,
  type AdCreativeGenerationMode,
  type AdCreativeRequest,
  type GeneratedAdSpec,
} from "./ads-creative-policy";

export interface AdSpec extends GeneratedAdSpec {
  reasoning: string;
  council: CouncilResult;
  generation: {
    mode: AdCreativeGenerationMode;
    generatedAt: string;
  };
  context: {
    facebookPageId: string;
    campaignHistory: "page_owned_autospa_campaigns" | "none";
    competitorMemory: "account_global";
  };
  estimates: {
    ctr: AdCreativeEstimateSource;
    roas: AdCreativeEstimateSource;
  };
  warnings: string[];
}

interface CampaignHistory {
  service: string | null;
  totalRevenue: number;
  bookings: number;
  // CTR/spend would come from FB Insights — placeholder here
}

async function getCampaignHistory(facebookPageId: string): Promise<CampaignHistory[]> {
  const operations = await prisma.adsCreateOperation.findMany({
    where: { facebookPageId, campaignId: { not: null } },
    select: { campaignId: true },
  });
  const campaignIds = [...new Set(operations.flatMap((operation) => operation.campaignId ? [operation.campaignId] : []))];
  if (!campaignIds.length) return [];

  const revenues = await prisma.bookingRevenue.findMany({
    where: { fromCampaignId: { in: campaignIds } },
    select: { service: true, amount: true, fromCampaignId: true },
  });

  const byCampaign = new Map<string, CampaignHistory>();
  for (const r of revenues) {
    if (!r.fromCampaignId) continue;
    const cur = byCampaign.get(r.fromCampaignId) ?? { service: r.service, totalRevenue: 0, bookings: 0 };
    cur.totalRevenue += r.amount;
    cur.bookings++;
    byCampaign.set(r.fromCampaignId, cur);
  }
  return Array.from(byCampaign.values()).sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 5);
}

export async function generateAdCreative(opts: AdCreativeRequest): Promise<AdSpec> {
  const { facebookPageId, serviceId, dailyBudget, objective, notes } = opts;

  const [service, brand, history, topPosts, competitorCtx] = await Promise.all([
    serviceId ? prisma.service.findFirst({ where: { id: serviceId, facebookPageId } }) : null,
    prisma.brandKit.findUnique({ where: { facebookPageId } }),
    getCampaignHistory(facebookPageId),
    prisma.post.findMany({
      where: { facebookPageId, status: "published", ...(serviceId ? { serviceId } : {}) },
      orderBy: { analytics: { likes: "desc" } },
      include: { analytics: true },
      take: 3,
    }),
    getCompetitorContext(),
  ]);
  if (serviceId && !service) throw new Error("Dịch vụ không thuộc Facebook Page đã chọn");

  const serviceInfo = service
    ? `Dịch vụ: ${service.name} (${service.price ?? "liên hệ"}) — ${service.description ?? ""}`
    : "Chưa chỉ định dịch vụ — đề xuất chung";

  const historyText = history.length
    ? history.map((h, i) => `Top ${i + 1}: ${h.service ?? "?"} → ${h.totalRevenue.toLocaleString("vi-VN")}đ (${h.bookings} đơn)`).join("\n")
    : "Chưa có lịch sử campaign";

  const topPostText = topPosts.length
    ? topPosts.map((p, i) => `${i + 1}. "${p.caption.slice(0, 100)}" — ${p.analytics?.likes ?? 0} likes`).join("\n")
    : "Chưa có bài viết";

  const context = `${serviceInfo}
${brand?.spaName ? `Spa: ${brand.spaName}` : ""}
${brand?.tagline ? `Tagline: ${brand.tagline}` : ""}

LỊCH SỬ CAMPAIGN (theo revenue):
${historyText}

TOP BÀI HỮU CƠ:
${topPostText}

RADAR ĐỐI THỦ:
${competitorCtx.insight || "Chưa có competitor memory"}
${competitorCtx.recommendations.length ? `Gợi ý phản ứng: ${competitorCtx.recommendations.slice(0, 3).join(" | ")}` : ""}
Quy tắc: chỉ dùng insight thị trường, không copy câu chữ/offer đối thủ, không tự động publish.

Mục tiêu: ${objective}
${dailyBudget ? `Budget user đề xuất: ${dailyBudget.toLocaleString("vi-VN")}đ/ngày` : "Budget: tự đề xuất"}
${notes ? `Ghi chú: ${notes}` : ""}`;

  // AI Council debates the strategy
  const council = await councilDebate({
    topic: `Thiết kế quảng cáo FB cho ${service?.name ?? "spa"} — caption + audience + budget tối ưu`,
    context,
  });

  // Synthesizer's text → structured spec via format prompt
  const formatPrompt = `Đây là quyết định từ AI Council:

${council.synthesis}

BỐI CẢNH:
${context}

Convert quyết định thành JSON CHÍNH XÁC theo định dạng:
{
  "captions": [
    { "text": "caption ngắn 80-150 từ", "hashtags": "#spa #...", "tone": "friendly|professional|luxury" }
  ],
  "audience": {
    "ageMin": 25,
    "ageMax": 45,
    "gender": "female|male|all",
    "locations": ["TP.HCM", "Hà Nội", ...],
    "interests": ["làm đẹp", "skincare", ...]
  },
  "dailyBudget": 200000,
  "durationDays": 7,
  "predictedCtr": 1.8,
  "predictedRoas": 3.2
}

3 caption variants tone khác nhau. audience cụ thể. Budget hợp lý (VND/ngày). Predict dựa lịch sử nếu có, nếu không thì ước tính bảo thủ. Chỉ trả JSON.`;

  let spec: GeneratedAdSpec | null = null;
  try {
    const raw = await generateContent(formatPrompt, "Bạn là người định dạng JSON. Luôn trả JSON hợp lệ.");
    spec = parseGeneratedAdSpecText(raw);
  } catch {
    spec = null;
  }

  const mode: AdCreativeGenerationMode = spec ? "ai" : "deterministic_fallback";
  const warnings = spec
    ? ["CTR và ROAS là ước tính heuristic; hệ thống chưa dùng Meta Insights lịch sử để huấn luyện forecast."]
    : ["AI không trả structured output hợp lệ; đang dùng fallback bảo thủ.", "CTR và ROAS là ước tính heuristic, không phải số đo lịch sử."];
  const output = spec ?? buildAdCreativeFallback({ serviceName: service?.name, dailyBudget });

  return {
    ...output,
    reasoning: council.synthesis,
    council,
    generation: { mode, generatedAt: new Date().toISOString() },
    context: {
      facebookPageId,
      campaignHistory: history.length ? "page_owned_autospa_campaigns" : "none",
      competitorMemory: "account_global",
    },
    estimates: { ctr: "heuristic", roas: "heuristic" },
    warnings,
  };
}
