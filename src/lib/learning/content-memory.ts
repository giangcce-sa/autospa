import { prisma } from "@/lib/db";

export interface ContentContext {
  bestTone: string | null;
  bestPostType: string | null;
  topKeywords: string[];
  topHashtags: string[];
  bestHour: number | null;
  bestDayOfWeek: number | null;
  insight: string;
}

// Runs nightly — mines PostAnalytics to find what style/topic drives engagement
export async function learnContentPatterns(): Promise<{ updated: number; insights: string[] }> {
  const insights: string[] = [];

  // Posts with analytics from last 90 days
  const posts = await prisma.post.findMany({
    where: {
      publishedAt: { not: null, gte: new Date(Date.now() - 90 * 86400000) },
      analytics: { isNot: null },
    },
    include: { analytics: true },
    orderBy: { publishedAt: "desc" },
    take: 200,
  });

  if (posts.length === 0) return { updated: 0, insights: ["Chưa đủ dữ liệu post"] };

  // Compute engagement score per post
  const scored = posts
    .filter((p) => p.analytics)
    .map((p) => {
      const a = p.analytics!;
      const engagement = a.likes + a.comments * 2 + a.shares * 3;
      const publishedAt = p.publishedAt!;
      return {
        tone: p.tone,
        postType: p.postType,
        hashtags: p.hashtags ? p.hashtags.split(/[\s,]+/).filter(Boolean) : [],
        caption: p.caption,
        engagement,
        hour: publishedAt.getHours(),
        dayOfWeek: publishedAt.getDay(),
      };
    });

  if (scored.length === 0) return { updated: 0, insights: ["Chưa đủ dữ liệu analytics"] };

  const avgEngAll = scored.reduce((s, p) => s + p.engagement, 0) / scored.length;

  // Best tone
  const toneMap: Record<string, { sum: number; count: number }> = {};
  for (const p of scored) {
    if (!p.tone) continue;
    if (!toneMap[p.tone]) toneMap[p.tone] = { sum: 0, count: 0 };
    toneMap[p.tone].sum += p.engagement;
    toneMap[p.tone].count += 1;
  }
  const bestToneEntry = Object.entries(toneMap).sort(
    (a, b) => b[1].sum / b[1].count - a[1].sum / a[1].count
  )[0];
  const bestTone = bestToneEntry?.[0] ?? null;
  if (bestTone) insights.push(`Tone "${bestTone}" đạt engagement cao nhất`);

  // Best post type
  const typeMap: Record<string, { sum: number; count: number }> = {};
  for (const p of scored) {
    if (!p.postType) continue;
    if (!typeMap[p.postType]) typeMap[p.postType] = { sum: 0, count: 0 };
    typeMap[p.postType].sum += p.engagement;
    typeMap[p.postType].count += 1;
  }
  const bestTypeEntry = Object.entries(typeMap).sort(
    (a, b) => b[1].sum / b[1].count - a[1].sum / a[1].count
  )[0];
  const bestPostType = bestTypeEntry?.[0] ?? null;
  if (bestPostType) insights.push(`Loại post "${bestPostType}" hiệu quả nhất`);

  // Top keywords from high-performing captions
  const topPosts = scored
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, Math.ceil(scored.length * 0.2));

  const wordFreq: Record<string, number> = {};
  const stopwords = new Set(["và", "của", "cho", "với", "là", "có", "được", "bạn", "tại", "spa", "các"]);
  for (const p of topPosts) {
    const words = p.caption
      .toLowerCase()
      .replace(/[^\wÀ-ỹ\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !stopwords.has(w));
    for (const w of words) wordFreq[w] = (wordFreq[w] ?? 0) + 1;
  }
  const topKeywords = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([w]) => w);

  // Top hashtags
  const hashFreq: Record<string, number> = {};
  for (const p of topPosts) {
    for (const h of p.hashtags) hashFreq[h] = (hashFreq[h] ?? 0) + 1;
  }
  const topHashtags = Object.entries(hashFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([h]) => h);

  // Best hour to post
  const hourMap: Record<number, { sum: number; count: number }> = {};
  for (const p of scored) {
    if (!hourMap[p.hour]) hourMap[p.hour] = { sum: 0, count: 0 };
    hourMap[p.hour].sum += p.engagement;
    hourMap[p.hour].count += 1;
  }
  const bestHourEntry = Object.entries(hourMap).sort(
    (a, b) => b[1].sum / b[1].count - a[1].sum / a[1].count
  )[0];
  const bestHour = bestHourEntry ? parseInt(bestHourEntry[0]) : null;
  if (bestHour !== null) insights.push(`Giờ đăng tốt nhất: ${bestHour}:00`);

  // Best day of week
  const dayMap: Record<number, { sum: number; count: number }> = {};
  for (const p of scored) {
    if (!dayMap[p.dayOfWeek]) dayMap[p.dayOfWeek] = { sum: 0, count: 0 };
    dayMap[p.dayOfWeek].sum += p.engagement;
    dayMap[p.dayOfWeek].count += 1;
  }
  const bestDayEntry = Object.entries(dayMap).sort(
    (a, b) => b[1].sum / b[1].count - a[1].sum / a[1].count
  )[0];
  const bestDayOfWeek = bestDayEntry ? parseInt(bestDayEntry[0]) : null;
  const dayNames = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  if (bestDayOfWeek !== null) insights.push(`Ngày đăng tốt nhất: ${dayNames[bestDayOfWeek]}`);

  // Upsert memory record
  const existing = await prisma.contentMemory.findFirst({ where: { platform: "facebook" } });
  const data = {
    tone: bestTone,
    postType: bestPostType,
    topKeywords: JSON.stringify(topKeywords),
    topHashtags: JSON.stringify(topHashtags),
    avgEngagement: avgEngAll,
    sampleCount: scored.length,
    bestHour,
    bestDayOfWeek,
    platform: "facebook",
  };

  if (existing) {
    await prisma.contentMemory.update({ where: { id: existing.id }, data });
  } else {
    await prisma.contentMemory.create({ data });
  }

  // Store insight in LearningInsight log
  await prisma.learningInsight.create({
    data: {
      loop: "content",
      insight: insights.join(" · "),
      confidence: Math.min(scored.length / 50, 1),
      appliedTo: "content-generator",
    },
  });

  return { updated: scored.length, insights };
}

// Called by content generator to enrich system prompt
export async function getContentContext(): Promise<ContentContext> {
  const mem = await prisma.contentMemory.findFirst({ where: { platform: "facebook" } });
  if (!mem) {
    return { bestTone: null, bestPostType: null, topKeywords: [], topHashtags: [], bestHour: null, bestDayOfWeek: null, insight: "" };
  }

  const topKeywords: string[] = JSON.parse(mem.topKeywords || "[]");
  const topHashtags: string[] = JSON.parse(mem.topHashtags || "[]");
  const dayNames = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

  const parts: string[] = [];
  if (mem.tone) parts.push(`tone hiệu quả nhất: ${mem.tone}`);
  if (mem.postType) parts.push(`loại post tốt nhất: ${mem.postType}`);
  if (mem.bestHour !== null) parts.push(`giờ đăng tốt: ${mem.bestHour}:00`);
  if (mem.bestDayOfWeek !== null) parts.push(`ngày tốt: ${dayNames[mem.bestDayOfWeek]}`);
  if (topKeywords.length) parts.push(`từ khóa hiệu quả: ${topKeywords.slice(0, 5).join(", ")}`);

  return {
    bestTone: mem.tone,
    bestPostType: mem.postType,
    topKeywords,
    topHashtags,
    bestHour: mem.bestHour,
    bestDayOfWeek: mem.bestDayOfWeek,
    insight: parts.join("; "),
  };
}
