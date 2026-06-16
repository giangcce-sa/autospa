import { prisma } from "@/lib/db";

// Runs nightly — find concluded AB tests, learn from winner, update ContentMemory
export async function learnFromAbTests(): Promise<{ processed: number; insights: string[] }> {
  const insights: string[] = [];

  // Find AB groups where both posts have analytics AND one is marked winner
  const abGroups = await prisma.post.findMany({
    where: {
      abGroupId: { not: null },
      qualityNotes: { contains: "A/B Test" },
    },
    include: { analytics: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Group posts by abGroupId
  const grouped: Record<string, typeof abGroups> = {};
  for (const p of abGroups) {
    const key = p.abGroupId!;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(p);
  }

  let processed = 0;
  const winnerPatterns: { tone: string; postType: string; keywords: string[] }[] = [];

  for (const [abGroupId, posts] of Object.entries(grouped)) {
    if (posts.length < 2) continue;

    const winner = posts.find((p) => p.qualityNotes?.includes("Thắng"));
    const loser = posts.find((p) => p.qualityNotes?.includes("Thua"));

    if (!winner) {
      // Auto-determine winner by engagement if both have analytics
      const withAnalytics = posts.filter((p) => p.analytics);
      if (withAnalytics.length < 2) continue;

      const [a, b] = withAnalytics.sort(
        (x, y) =>
          (y.analytics!.likes + y.analytics!.comments * 2 + y.analytics!.shares * 3) -
          (x.analytics!.likes + x.analytics!.comments * 2 + x.analytics!.shares * 3)
      );

      const winEng = a.analytics!.likes + a.analytics!.comments * 2 + a.analytics!.shares * 3;
      const loseEng = b.analytics!.likes + b.analytics!.comments * 2 + b.analytics!.shares * 3;

      if (winEng <= loseEng) continue; // no clear winner

      // Auto-declare winner
      await prisma.post.update({
        where: { id: a.id },
        data: { qualityNotes: `A/B Test — Thắng (auto, ${abGroupId})` },
      });
      await prisma.post.update({
        where: { id: b.id },
        data: { qualityNotes: `A/B Test — Thua (auto, ${abGroupId})` },
      });

      winnerPatterns.push({
        tone: a.tone,
        postType: a.postType,
        keywords: extractKeywords(a.caption),
      });

      const margin = loseEng > 0 ? Math.round(((winEng - loseEng) / loseEng) * 100) : 100;
      insights.push(`[${abGroupId.slice(0, 6)}] Tone "${a.tone}" thắng ${margin}% engagement so với "${b.tone}"`);
      processed++;
    } else if (loser) {
      winnerPatterns.push({
        tone: winner.tone,
        postType: winner.postType,
        keywords: extractKeywords(winner.caption),
      });
      insights.push(`[${abGroupId.slice(0, 6)}] Tone "${winner.tone}" đã được xác nhận thắng`);
      processed++;
    }
  }

  // Merge winner patterns into ContentMemory
  if (winnerPatterns.length > 0) {
    const mem = await prisma.contentMemory.findFirst({ where: { platform: "facebook" } });

    const toneCounts: Record<string, number> = {};
    const typeCounts: Record<string, number> = {};
    for (const p of winnerPatterns) {
      toneCounts[p.tone] = (toneCounts[p.tone] ?? 0) + 1;
      typeCounts[p.postType] = (typeCounts[p.postType] ?? 0) + 1;
    }
    const abBestTone = Object.entries(toneCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const abBestType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const allKeywords = winnerPatterns.flatMap((p) => p.keywords);
    const kwFreq: Record<string, number> = {};
    for (const k of allKeywords) kwFreq[k] = (kwFreq[k] ?? 0) + 1;
    const topNewKw = Object.entries(kwFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k]) => k);

    const existingKw: string[] = JSON.parse(mem?.topKeywords ?? "[]");
    const mergedKw = Array.from(new Set([...topNewKw, ...existingKw])).slice(0, 12);

    if (mem) {
      await prisma.contentMemory.update({
        where: { id: mem.id },
        data: {
          tone: abBestTone ?? mem.tone,
          postType: abBestType ?? mem.postType,
          topKeywords: JSON.stringify(mergedKw),
        },
      });
    }
  }

  if (processed > 0) {
    await prisma.learningInsight.create({
      data: {
        loop: "ab",
        insight: insights.join(" · "),
        confidence: Math.min(processed / 5, 1),
        appliedTo: "content-generator, content-memory",
      },
    });
  }

  return { processed, insights };
}

function extractKeywords(text: string): string[] {
  const stopwords = new Set(["và", "của", "cho", "với", "là", "có", "được", "bạn", "tại", "spa", "các"]);
  return text
    .toLowerCase()
    .replace(/[^\wÀ-ỹ\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopwords.has(w))
    .slice(0, 8);
}
