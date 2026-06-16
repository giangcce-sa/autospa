import { prisma } from "./db";
import { councilDebate, type CouncilResult } from "./ai-council";
import { generateContent } from "./claude";

export interface AdSpec {
  captions: { text: string; hashtags: string; tone: string }[];
  audience: {
    ageMin: number;
    ageMax: number;
    gender: "all" | "female" | "male";
    locations: string[];
    interests: string[];
  };
  dailyBudget: number;        // VND
  durationDays: number;
  predictedCtr: number;        // %
  predictedRoas: number;       // multiplier
  reasoning: string;           // synthesis
  council: CouncilResult;
}

interface CampaignHistory {
  service: string | null;
  totalRevenue: number;
  bookings: number;
  // CTR/spend would come from FB Insights — placeholder here
}

async function getCampaignHistory(serviceId?: string): Promise<CampaignHistory[]> {
  const where = serviceId
    ? { service: { contains: serviceId, mode: "insensitive" as const } }
    : {};

  const revenues = await prisma.bookingRevenue.findMany({
    where: {
      fromCampaignId: { not: null },
      ...where,
    },
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

export async function generateAdCreative(opts: {
  serviceId?: string;
  dailyBudget?: number;
  objective?: "conversions" | "engagement" | "reach";
  notes?: string;
}): Promise<AdSpec> {
  const { serviceId, dailyBudget, objective = "conversions", notes } = opts;

  // Pull context: service, brand, top historical campaigns, top organic posts
  const [service, brand, history, topPosts] = await Promise.all([
    serviceId ? prisma.service.findUnique({ where: { id: serviceId } }) : null,
    prisma.brandKit.findFirst(),
    getCampaignHistory(serviceId),
    prisma.post.findMany({
      where: { status: "published", ...(serviceId ? { serviceId } : {}) },
      orderBy: { analytics: { likes: "desc" } },
      include: { analytics: true },
      take: 3,
    }),
  ]);

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

  let spec: Omit<AdSpec, "reasoning" | "council"> | null = null;
  try {
    const raw = await generateContent(formatPrompt, "Bạn là người định dạng JSON. Luôn trả JSON hợp lệ.");
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      spec = JSON.parse(match[0]);
    }
  } catch {
    // fallback below
  }

  if (!spec) {
    // Fallback: hardcoded reasonable defaults
    spec = {
      captions: [
        {
          text: `${service?.name ?? "Dịch vụ spa"} cho làn da khỏe đẹp tự tin. Đặt lịch ngay để nhận ưu đãi.`,
          hashtags: "#spa #lamdep #chamsocda",
          tone: "friendly",
        },
      ],
      audience: {
        ageMin: 25,
        ageMax: 45,
        gender: "female",
        locations: ["TP.HCM"],
        interests: ["làm đẹp", "skincare", "spa"],
      },
      dailyBudget: dailyBudget ?? 200000,
      durationDays: 7,
      predictedCtr: 1.5,
      predictedRoas: history.length ? 2.5 : 1.8,
    };
  }

  return { ...spec, reasoning: council.synthesis, council };
}
