import { prisma } from "../db";
import { generateContent } from "../claude";

export interface ContentReport {
  summary: string;
  topPerformers: string[];
  underperformers: string[];
  recommendations: string[];
}

export async function generateContentReport(): Promise<ContentReport> {
  const since = new Date(Date.now() - 7 * 86400000);
  const prevSince = new Date(Date.now() - 14 * 86400000);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const inAWeek = new Date(tomorrow.getTime() + 7 * 86400000);

  const [posts7d, posts14dPrior, scheduledNext7d, drafts] = await Promise.all([
    prisma.post.findMany({
      where: { status: "published", publishedAt: { gte: since } },
      include: { analytics: true },
    }),
    prisma.post.findMany({
      where: { status: "published", publishedAt: { gte: prevSince, lt: since } },
      include: { analytics: true },
    }),
    prisma.post.count({ where: { status: "scheduled", scheduledAt: { gte: tomorrow, lt: inAWeek } } }),
    prisma.post.count({ where: { status: "draft" } }),
  ]);

  const engScore = (a: { likes: number; comments: number; shares: number } | null | undefined) =>
    a ? a.likes + a.comments * 2 + a.shares * 3 : 0;

  const eng7avg = posts7d.length ? posts7d.reduce((s, p) => s + engScore(p.analytics), 0) / posts7d.length : 0;
  const eng14avg = posts14dPrior.length ? posts14dPrior.reduce((s, p) => s + engScore(p.analytics), 0) / posts14dPrior.length : 0;
  const trend = eng14avg > 0 ? (eng7avg - eng14avg) / eng14avg : 0;

  const sorted = posts7d.sort((a, b) => engScore(b.analytics) - engScore(a.analytics));
  const top3 = sorted.slice(0, 3);
  const bottom3 = sorted.slice(-3).reverse();

  if (posts7d.length === 0) {
    return {
      summary: "Tuần qua không có bài đăng nào. Cần đẩy mạnh sản xuất content.",
      topPerformers: [],
      underperformers: [],
      recommendations: ["Tạo content plan ngay tại /content-research", "Setup cron auto-publish nếu chưa"],
    };
  }

  const topText = top3.map((p) => `- "${p.caption.slice(0, 80)}" — ${engScore(p.analytics)} điểm`).join("\n");
  const bottomText = bottom3.map((p) => `- "${p.caption.slice(0, 80)}" — ${engScore(p.analytics)} điểm`).join("\n");

  const prompt = `Bạn là Content Agent. Báo cáo hiệu quả content tuần qua.

THỐNG KÊ:
- Đã đăng: ${posts7d.length} bài (7d trước: ${posts14dPrior.length} bài)
- Engagement trung bình/bài: ${Math.round(eng7avg)} (so 7d trước: ${Math.round(eng14avg)}, ${trend >= 0 ? "+" : ""}${Math.round(trend * 100)}%)
- Đã lên lịch 7 ngày tới: ${scheduledNext7d} bài
- Draft chưa đăng: ${drafts}

TOP 3 BÀI:
${topText}

BOTTOM 3 BÀI:
${bottomText}

Trả về JSON CHÍNH XÁC:
{
  "summary": "2-3 câu tổng quan content (giọng thẳng thắn)",
  "topPerformers": ["pattern hoặc topic của top: ngắn gọn"],
  "underperformers": ["lý do tại sao bottom yếu (giả thuyết)"],
  "recommendations": ["đề xuất content direction 1-3"]
}

Chỉ trả JSON.`;

  try {
    const raw = await generateContent(prompt, "Bạn là Content Agent thẳng thắn. Trả JSON.");
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]) as ContentReport;
    }
  } catch { /* fallback */ }

  return {
    summary: `${posts7d.length} bài tuần qua, engagement TB ${Math.round(eng7avg)} (${trend >= 0 ? "+" : ""}${Math.round(trend * 100)}%).`,
    topPerformers: top3.map((p) => p.caption.slice(0, 60)),
    underperformers: [],
    recommendations: scheduledNext7d < 5 ? ["Sắp hết content lên lịch — gen plan mới"] : [],
  };
}
