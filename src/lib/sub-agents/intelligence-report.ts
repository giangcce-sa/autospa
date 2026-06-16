import { prisma } from "../db";
import { generateContent } from "../claude";
import { aggregateWeeklyInsights } from "../intelligence/aggregator";

export interface IntelligenceReport {
  summary: string;
  trends: string[];           // trending topics observed
  competitorAlerts: string[]; // notable competitor activity
  recommendations: string[];  // specific suggestions
}

export async function generateIntelligenceReport(): Promise<IntelligenceReport> {
  const since = new Date(Date.now() - 7 * 86400000);

  // Try multi-source aggregation first (best signal)
  try {
    const insight = await aggregateWeeklyInsights();
    if (insight.risingTopics.length > 0 || insight.competitorSignals.length > 0) {
      return {
        summary: insight.summary,
        trends: insight.risingTopics.map((t) => `${t.topic} (${t.source}, vol ${t.volume})`),
        competitorAlerts: insight.competitorSignals,
        recommendations: insight.recommendations,
      };
    }
  } catch { /* fallback to legacy below */ }

  const [topCompetitorPosts, socialAlerts, totalCompetitors] = await Promise.all([
    prisma.competitorPost.findMany({
      where: { publishedAt: { gte: since } },
      include: { competitor: { select: { name: true } } },
      orderBy: { likes: "desc" },
      take: 5,
    }),
    prisma.socialAlert.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.competitor.count({ where: { isActive: true } }),
  ]);

  if (topCompetitorPosts.length === 0 && socialAlerts.length === 0) {
    return {
      summary: totalCompetitors === 0
        ? "Chưa cấu hình đối thủ nào để theo dõi — không có insight thị trường tuần này."
        : "Không phát hiện hoạt động đáng kể từ đối thủ hoặc social signals tuần qua.",
      trends: [],
      competitorAlerts: [],
      recommendations: totalCompetitors === 0 ? ["Thêm 3-5 đối thủ vào /competitors để bắt đầu thu thập intel"] : [],
    };
  }

  const competitorText = topCompetitorPosts
    .map((p, i) => `${i + 1}. [${p.competitor.name}] ${p.likes} likes, ${p.comments} comments: "${p.message.slice(0, 200)}"`)
    .join("\n");

  const alertsText = socialAlerts.length
    ? socialAlerts.map((a) => `- [${a.severity}] ${a.type}: ${a.content.slice(0, 150)}`).join("\n")
    : "Không có alert";

  const prompt = `Bạn là Intelligence Agent. Phân tích hoạt động đối thủ và signal thị trường tuần qua.

TOP 5 BÀI ĐỐI THỦ VIRAL:
${competitorText}

SOCIAL ALERTS:
${alertsText}

Trả về JSON CHÍNH XÁC:
{
  "summary": "2-3 câu tổng quan thị trường spa tuần này",
  "trends": ["xu hướng 1", "xu hướng 2"],
  "competitorAlerts": ["đối thủ nào làm gì đáng chú ý"],
  "recommendations": ["hành động đề xuất 1", "hành động đề xuất 2"]
}

trends: chủ đề/dịch vụ đang hot (vd: "triệt lông bikini tăng 50%", "facial Hàn Quốc viral").
competitorAlerts: 1-3 mục thông tin đặc biệt.
recommendations: 1-3 hành động cụ thể.
Chỉ trả JSON.`;

  try {
    const raw = await generateContent(prompt, "Bạn là Intelligence Agent ngắn gọn, sắc bén. Luôn trả JSON.");
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]) as IntelligenceReport;
    }
  } catch { /* fallback */ }

  return {
    summary: `Theo dõi ${totalCompetitors} đối thủ — tuần qua có ${topCompetitorPosts.length} bài viral`,
    trends: [],
    competitorAlerts: topCompetitorPosts.slice(0, 3).map((p) => `${p.competitor.name} có bài ${p.likes} likes`),
    recommendations: [],
  };
}
