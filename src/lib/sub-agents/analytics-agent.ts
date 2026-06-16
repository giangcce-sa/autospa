import { prisma } from "../db";
import { generateContent } from "../claude";

export interface AnalyticsReport {
  summary: string;             // 3-5 sentence executive summary
  highlights: string[];        // 3-5 bullets
  anomalies: string[];         // unusual patterns flagged
  metrics: Record<string, number | string>;
  timeframe: string;
}

function vnd(n: number) { return Math.round(n).toLocaleString("vi-VN") + "đ"; }

export async function generateAnalyticsReport(timeframe: "7d" | "30d" = "7d"): Promise<AnalyticsReport> {
  const days = timeframe === "30d" ? 30 : 7;
  const since = new Date(Date.now() - days * 86400000);
  const prevSince = new Date(Date.now() - 2 * days * 86400000);

  // Pull metrics in parallel
  const [
    revCurrent, revPrev,
    bookingsCurrent, bookingsPrev,
    leadsCurrent, leadsPrev,
    postsPublished, allAnalytics,
    adLogs,
    topPosts,
    customerSegments,
  ] = await Promise.all([
    prisma.bookingRevenue.aggregate({ where: { paidAt: { gte: since } }, _sum: { amount: true } }),
    prisma.bookingRevenue.aggregate({ where: { paidAt: { gte: prevSince, lt: since } }, _sum: { amount: true } }),
    prisma.bookingRevenue.count({ where: { paidAt: { gte: since } } }),
    prisma.bookingRevenue.count({ where: { paidAt: { gte: prevSince, lt: since } } }),
    prisma.lead.count({ where: { createdAt: { gte: since } } }),
    prisma.lead.count({ where: { createdAt: { gte: prevSince, lt: since } } }),
    prisma.post.count({ where: { status: "published", publishedAt: { gte: since } } }),
    prisma.postAnalytics.findMany({ where: { fetchedAt: { gte: since } } }),
    prisma.adOptimizationLog.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.post.findMany({
      where: { status: "published", publishedAt: { gte: since } },
      include: { analytics: true },
      orderBy: { analytics: { likes: "desc" } },
      take: 3,
    }),
    prisma.customer.groupBy({ by: ["segment"], _count: true }),
  ]);

  const revenue = revCurrent._sum.amount ?? 0;
  const revenuePrev = revPrev._sum.amount ?? 0;
  const revenueDelta = revenuePrev > 0 ? (revenue - revenuePrev) / revenuePrev : 0;

  const leadDelta = leadsPrev > 0 ? (leadsCurrent - leadsPrev) / leadsPrev : 0;
  const bookingDelta = bookingsPrev > 0 ? (bookingsCurrent - bookingsPrev) / bookingsPrev : 0;

  const totalReach = allAnalytics.reduce((s, a) => s + a.reach, 0);
  const totalEng = allAnalytics.reduce((s, a) => s + a.likes + a.comments * 2 + a.shares * 3, 0);
  const avgEngPerPost = postsPublished > 0 ? totalEng / postsPublished : 0;

  const conversionRate = leadsCurrent > 0 ? (bookingsCurrent / leadsCurrent) * 100 : 0;

  const metrics: Record<string, number | string> = {
    revenue: vnd(revenue),
    revenueDeltaPct: Math.round(revenueDelta * 100),
    bookings: bookingsCurrent,
    bookingDeltaPct: Math.round(bookingDelta * 100),
    leads: leadsCurrent,
    leadDeltaPct: Math.round(leadDelta * 100),
    postsPublished,
    totalReach,
    avgEngPerPost: Math.round(avgEngPerPost),
    conversionRate: conversionRate.toFixed(1) + "%",
    pausedCampaigns: adLogs.filter((l) => l.action === "pause").length,
    scaledCampaigns: adLogs.filter((l) => l.action === "scale_up").length,
  };

  // Build Claude prompt
  const topPostsText = topPosts.length
    ? topPosts.map((p, i) => `${i + 1}. "${p.caption.slice(0, 80)}" — ${p.analytics?.likes ?? 0} likes`).join("\n")
    : "Chưa có bài đăng";

  const segmentText = customerSegments.map((s) => `${s.segment}: ${s._count}`).join(", ");

  const prompt = `Bạn là Analytics Agent — chuyên gia số liệu cho spa. Đọc các chỉ số sau và viết báo cáo executive ngắn.

THỜI GIAN: ${days} ngày qua (so với ${days} ngày trước đó)

CHỈ SỐ:
- Doanh thu: ${metrics.revenue} (${revenueDelta >= 0 ? "+" : ""}${metrics.revenueDeltaPct}%)
- Đơn hàng: ${bookingsCurrent} (${bookingDelta >= 0 ? "+" : ""}${metrics.bookingDeltaPct}%)
- Lead mới: ${leadsCurrent} (${leadDelta >= 0 ? "+" : ""}${metrics.leadDeltaPct}%)
- Tỷ lệ chuyển đổi lead → booking: ${metrics.conversionRate}
- Bài đăng: ${postsPublished} bài
- Reach tổng: ${totalReach.toLocaleString("vi-VN")}
- Engagement trung bình/bài: ${metrics.avgEngPerPost}
- Campaign: ${metrics.pausedCampaigns} pause, ${metrics.scaledCampaigns} scale-up
- Phân khúc khách: ${segmentText}

TOP 3 BÀI:
${topPostsText}

Trả về JSON CHÍNH XÁC:
{
  "summary": "3-5 câu tổng quan tình hình (giọng đồng nghiệp, không sáo rỗng)",
  "highlights": ["bullet 1", "bullet 2", "bullet 3"],
  "anomalies": ["bất thường 1 nếu có", "bất thường 2"]
}

highlights: 3-5 điểm tích cực hoặc đáng chú ý.
anomalies: 0-3 điểm cảnh báo (ví dụ: revenue tăng nhưng lead giảm, engagement drop bất thường...). Nếu không có thì array rỗng.
Chỉ trả JSON.`;

  let summary = `Doanh thu ${days} ngày qua đạt ${metrics.revenue}.`;
  let highlights: string[] = [];
  let anomalies: string[] = [];

  try {
    const raw = await generateContent(prompt, "Bạn là Analytics Agent chuyên nghiệp, viết tiếng Việt súc tích. Luôn trả JSON hợp lệ.");
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as { summary?: string; highlights?: string[]; anomalies?: string[] };
      if (parsed.summary) summary = parsed.summary;
      if (parsed.highlights) highlights = parsed.highlights;
      if (parsed.anomalies) anomalies = parsed.anomalies;
    }
  } catch {
    // Fallback stays as default
    if (revenueDelta < -0.2) anomalies.push(`Doanh thu giảm ${Math.round(-revenueDelta * 100)}%`);
    if (leadDelta < -0.3) anomalies.push(`Lead giảm ${Math.round(-leadDelta * 100)}%`);
  }

  return {
    summary,
    highlights,
    anomalies,
    metrics,
    timeframe: `${days} ngày`,
  };
}
