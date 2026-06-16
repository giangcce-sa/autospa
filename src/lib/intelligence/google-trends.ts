import { prisma } from "../db";
import { generateContent } from "../claude";

/**
 * Pull daily trending searches in Vietnam from Google Trends.
 * Uses the unofficial dailytrends endpoint (no API key needed).
 * Then filters for beauty/spa relevance via Claude.
 */
interface DailyTrend {
  title: string;
  traffic: string;        // "10K+"
  shareUrl?: string;
}

async function fetchVietnamDailyTrends(): Promise<DailyTrend[]> {
  const url = "https://trends.google.com/trends/api/dailytrends?geo=VN&hl=vi";
  try {
    const res = await fetch(url);
    const text = await res.text();
    // Google prepends ")]}'" to prevent JSON hijacking
    const clean = text.replace(/^\)\]\}',?\s*/, "");
    const data = JSON.parse(clean);

    const days = data.default?.trendingSearchesDays ?? [];
    const trends: DailyTrend[] = [];
    for (const day of days.slice(0, 2)) {
      for (const search of day.trendingSearches ?? []) {
        trends.push({
          title: search.title?.query ?? "",
          traffic: search.formattedTraffic ?? "0",
        });
      }
    }
    return trends.filter((t) => t.title);
  } catch {
    return [];
  }
}

/**
 * Filter raw trends → keep only beauty/spa relevant ones.
 * Volume is parsed from "100K+" etc into number.
 */
function parseTraffic(traffic: string): number {
  const match = traffic.match(/(\d+(?:\.\d+)?)\s*([KM]?)/);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  const unit = match[2];
  if (unit === "M") return num * 1_000_000;
  if (unit === "K") return num * 1_000;
  return num;
}

async function filterBeautyRelevant(trends: DailyTrend[]): Promise<DailyTrend[]> {
  if (trends.length === 0) return [];

  const list = trends.map((t, i) => `${i + 1}. ${t.title}`).join("\n");

  const prompt = `Đây là các từ khóa đang trending tại Việt Nam:

${list}

Hãy lọc ra TỪ KHÓA NÀO LIÊN QUAN BEAUTY/SPA/LÀM ĐẸP/SỨC KHỎE. Trả về JSON array các số thứ tự (chỉ số, không giải thích):
[3, 7, 12]

Nếu không có cái nào liên quan, trả [].`;

  try {
    const raw = await generateContent(prompt, "Bạn lọc keyword. Trả JSON array số nguyên hợp lệ.");
    const match = raw.match(/\[[\s\S]*?\]/);
    if (!match) return [];
    const indices = JSON.parse(match[0]) as number[];
    return indices.map((i) => trends[i - 1]).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Pull + filter + save signals to DB. Returns count of beauty-relevant trends saved.
 */
export async function syncGoogleTrends(): Promise<{ saved: number; total: number }> {
  const rawTrends = await fetchVietnamDailyTrends();
  if (rawTrends.length === 0) return { saved: 0, total: 0 };

  const beauty = await filterBeautyRelevant(rawTrends);

  let saved = 0;
  for (const t of beauty) {
    try {
      // Determine trend direction by comparing with last fetch
      const volume = parseTraffic(t.traffic);
      const previous = await prisma.intelligenceSignal.findFirst({
        where: { source: "google_trends", topic: t.title },
        orderBy: { fetchedAt: "desc" },
      });

      let trend: "rising" | "stable" | "falling" = "rising";  // appearing in daily trends = rising
      if (previous && volume < previous.volume * 0.7) trend = "falling";

      await prisma.intelligenceSignal.create({
        data: {
          source: "google_trends",
          topic: t.title,
          volume,
          trend,
          details: JSON.stringify({ traffic: t.traffic }),
        },
      });
      saved++;
    } catch { /* skip individual */ }
  }

  return { saved, total: rawTrends.length };
}
