import { prisma } from "../db";
import { generateContent } from "../claude";
import { syncAdsLibrary } from "./ads-library";
import { syncGoogleTrends } from "./google-trends";

export interface AggregatedInsight {
  summary: string;
  risingTopics: { topic: string; source: string; volume: number; trend: string }[];
  competitorSignals: string[];
  recommendations: string[];
}

const SOURCE_LABEL: Record<string, string> = {
  fb_ads_library: "FB Ads Library",
  google_trends: "Google Trends",
  fb_competitor: "FB Đối thủ",
  manual: "Manual",
};

/**
 * Run sync of all sources, then aggregate insights for the past 7 days.
 */
export async function aggregateWeeklyInsights(): Promise<AggregatedInsight> {
  // 1. Sync sources in parallel (best effort)
  await Promise.allSettled([
    syncAdsLibrary(),
    syncGoogleTrends(),
  ]);

  // 2. Pull recent signals (7 days)
  const since = new Date(Date.now() - 7 * 86400000);
  const signals = await prisma.intelligenceSignal.findMany({
    where: { fetchedAt: { gte: since } },
    orderBy: { volume: "desc" },
    take: 30,
  });

  // 3. Also pull competitor posts
  const competitorPosts = await prisma.competitorPost.findMany({
    where: { publishedAt: { gte: since } },
    include: { competitor: { select: { name: true } } },
    orderBy: { likes: "desc" },
    take: 5,
  });

  // Rising topics
  const rising = signals
    .filter((s) => s.trend === "rising")
    .slice(0, 10)
    .map((s) => ({
      topic: s.topic,
      source: SOURCE_LABEL[s.source] ?? s.source,
      volume: s.volume,
      trend: s.trend,
    }));

  const competitorSignals = competitorPosts.map((p) => `${p.competitor.name}: "${p.message.slice(0, 100)}" (${p.likes} likes)`);

  // 4. Claude summarizer
  const signalsText = signals.slice(0, 15).map((s) => `- [${SOURCE_LABEL[s.source]}] ${s.topic} (volume: ${s.volume}, trend: ${s.trend})`).join("\n");
  const compText = competitorSignals.length ? competitorSignals.map((c) => `- ${c}`).join("\n") : "(không có)";

  const prompt = `Bạn là Intelligence Agent cao cấp. Tổng hợp insight thị trường spa Việt Nam tuần qua.

SIGNALS THU THẬP ĐƯỢC:
${signalsText || "(không có data)"}

ĐỐI THỦ HOẠT ĐỘNG NỔI BẬT:
${compText}

Trả về JSON CHÍNH XÁC:
{
  "summary": "1-2 câu insight chính tuần này (vd: 'Triệt lông bikini tăng mạnh - nhiều đối thủ chạy ads')",
  "recommendations": ["hành động 1", "hành động 2"]
}

summary: súc tích, có insight, không lặp data thô.
recommendations: 2-3 hành động cụ thể cho spa.
Chỉ trả JSON.`;

  let summary = "Tuần này chưa có signal đặc biệt từ thị trường beauty.";
  let recommendations: string[] = [];

  try {
    const raw = await generateContent(prompt, "Bạn là Intelligence Agent sắc bén. Trả JSON.");
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as { summary?: string; recommendations?: string[] };
      if (parsed.summary) summary = parsed.summary;
      if (parsed.recommendations) recommendations = parsed.recommendations;
    }
  } catch { /* fallback */ }

  return {
    summary,
    risingTopics: rising,
    competitorSignals,
    recommendations,
  };
}
