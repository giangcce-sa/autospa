import { prisma } from "../db";
import { generateContent } from "../claude";

export interface AdsReport {
  summary: string;
  performance: string[];
  alerts: string[];
  recommendations: string[];
}

export async function generateAdsReport(): Promise<AdsReport> {
  const since = new Date(Date.now() - 7 * 86400000);

  const [adLogs, revenueAttributed] = await Promise.all([
    prisma.adOptimizationLog.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.bookingRevenue.findMany({
      where: { paidAt: { gte: since }, fromCampaignId: { not: null } },
      select: { amount: true, fromCampaignId: true },
    }),
  ]);

  const totalAdRevenue = revenueAttributed.reduce((s, r) => s + r.amount, 0);
  const uniqueCampaigns = new Set(revenueAttributed.map((r) => r.fromCampaignId)).size;

  const pauseCount = adLogs.filter((l) => l.action === "pause").length;
  const scaleCount = adLogs.filter((l) => l.action === "scale_up").length;

  if (adLogs.length === 0 && totalAdRevenue === 0) {
    return {
      summary: "Không có hoạt động ads tuần qua.",
      performance: [],
      alerts: ["Có thể chưa cấu hình ads — vào /facebook-ads để bắt đầu"],
      recommendations: ["Setup Facebook Ad Account để Ads Agent có thể tự động tối ưu"],
    };
  }

  const logSummary = adLogs.slice(0, 5)
    .map((l) => `- ${l.action} "${l.campaignName}": ${l.reason}`)
    .join("\n");

  const prompt = `Bạn là Ads Agent. Báo cáo hoạt động Facebook Ads tuần qua.

7 NGÀY QUA:
- Doanh thu attributed: ${totalAdRevenue.toLocaleString("vi-VN")}đ từ ${uniqueCampaigns} campaign
- ${pauseCount} campaign bị pause tự động (CTR thấp)
- ${scaleCount} campaign được scale-up (CTR cao)

LOG OPTIMIZER GẦN NHẤT:
${logSummary || "(không có)"}

Trả về JSON CHÍNH XÁC:
{
  "summary": "2-3 câu tổng quan ads",
  "performance": ["điểm hiệu quả 1", "điểm hiệu quả 2"],
  "alerts": ["cảnh báo nếu có"],
  "recommendations": ["đề xuất hành động"]
}

Chỉ trả JSON.`;

  try {
    const raw = await generateContent(prompt, "Bạn là Ads Agent sắc bén. Trả JSON.");
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]) as AdsReport;
    }
  } catch { /* fallback */ }

  return {
    summary: `Tuần qua: ${totalAdRevenue.toLocaleString("vi-VN")}đ từ ${uniqueCampaigns} campaign. ${pauseCount} pause, ${scaleCount} scale-up.`,
    performance: [],
    alerts: pauseCount > 3 ? [`${pauseCount} campaign bị pause — cần review setup`] : [],
    recommendations: [],
  };
}
