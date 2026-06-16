import { prisma } from "../db";
import { generateContent } from "../claude";

export interface SalesReport {
  summary: string;
  funnelStats: string[];
  hotLeads: string[];
  recommendations: string[];
}

export async function generateSalesReport(): Promise<SalesReport> {
  const since = new Date(Date.now() - 7 * 86400000);
  const prevSince = new Date(Date.now() - 14 * 86400000);

  const [newLeads, newLeadsPrev, hot, closed, closedPrev, coldNurtured, conversations] = await Promise.all([
    prisma.lead.count({ where: { createdAt: { gte: since } } }),
    prisma.lead.count({ where: { createdAt: { gte: prevSince, lt: since } } }),
    prisma.lead.count({ where: { stage: "hot" } }),
    prisma.lead.count({ where: { stage: "closed", updatedAt: { gte: since } } }),
    prisma.lead.count({ where: { stage: "closed", updatedAt: { gte: prevSince, lt: since } } }),
    prisma.lead.count({ where: { stage: "cold", nurtureStep: { gte: 3 } } }),
    prisma.leadConversation.count({ where: { isComplete: true, updatedAt: { gte: since } } }),
  ]);

  const leadDelta = newLeadsPrev > 0 ? (newLeads - newLeadsPrev) / newLeadsPrev : 0;
  const closedDelta = closedPrev > 0 ? (closed - closedPrev) / closedPrev : 0;
  const conversionRate = newLeads > 0 ? (closed / newLeads) * 100 : 0;

  if (newLeads === 0 && hot === 0) {
    return {
      summary: "Không có lead mới tuần qua. Lead pipeline trống.",
      funnelStats: [],
      hotLeads: [],
      recommendations: ["Đẩy mạnh content + ads để tạo lead", "Setup Lead Agent (chatbot FB/Zalo) nếu chưa"],
    };
  }

  const prompt = `Bạn là Sales Agent. Báo cáo lead funnel tuần qua.

7 NGÀY QUA:
- Lead mới: ${newLeads} (so 7d trước: ${newLeadsPrev}, ${leadDelta >= 0 ? "+" : ""}${Math.round(leadDelta * 100)}%)
- Lead nóng đang giữ: ${hot}
- Đã chốt: ${closed} (so 7d trước: ${closedPrev}, ${closedDelta >= 0 ? "+" : ""}${Math.round(closedDelta * 100)}%)
- Tỷ lệ chốt: ${conversionRate.toFixed(1)}%
- Lead lạnh đã nurture đủ 3 bước (sắp mất): ${coldNurtured}
- Conversation Lead Agent hoàn tất: ${conversations}

Trả về JSON CHÍNH XÁC:
{
  "summary": "2-3 câu tổng quan sales pipeline",
  "funnelStats": ["mô tả funnel: số liệu chính"],
  "hotLeads": ["mức độ ưu tiên xử lý hot leads"],
  "recommendations": ["đề xuất hành động 1-3"]
}

Chỉ trả JSON.`;

  try {
    const raw = await generateContent(prompt, "Bạn là Sales Agent quyết liệt. Trả JSON.");
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]) as SalesReport;
    }
  } catch { /* fallback */ }

  return {
    summary: `${newLeads} lead mới, ${hot} hot, ${closed} closed (${conversionRate.toFixed(1)}% conversion).`,
    funnelStats: [`Lead mới: ${newLeads}`, `Hot: ${hot}`, `Closed: ${closed}`],
    hotLeads: hot > 10 ? [`${hot} lead nóng chưa chốt — ưu tiên cao`] : [],
    recommendations: coldNurtured > 0 ? [`${coldNurtured} lead sắp mất — chạy proactive outreach`] : [],
  };
}
