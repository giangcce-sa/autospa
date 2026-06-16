import { prisma } from "@/lib/db";
import { generateChatCompletion } from "@/lib/openai";

// Runs nightly — check CEODecisions due for outcome evaluation
export async function evaluateDecisionOutcomes(): Promise<{ evaluated: number; insights: string[] }> {
  const insights: string[] = [];

  const pending = await prisma.cEODecision.findMany({
    where: {
      OR: [{ outcomeStatus: "pending" }, { outcomeStatus: null }],
      outcomeCheckAt: { not: null, lte: new Date() },
      outcomeMetric: { not: null },
    },
    orderBy: { outcomeCheckAt: "asc" },
    take: 20,
  });

  let evaluated = 0;

  for (const decision of pending) {
    try {
      const current = await fetchMetricValue(decision.outcomeMetric!);
      if (current === null) continue;

      const before = decision.outcomeBefore ?? 0;
      const delta = before > 0 ? (current - before) / before : 0;

      let outcomeStatus: string;
      if (delta > 0.05) outcomeStatus = "success";
      else if (delta < -0.05) outcomeStatus = "fail";
      else outcomeStatus = "neutral";

      // Ask AI to narrate the outcome
      const prompt = `Quyết định: ${decision.topic}
Bối cảnh: ${decision.context.slice(0, 300)}
Metric: ${decision.outcomeMetric} — Trước: ${before.toLocaleString()} → Sau: ${current.toLocaleString()} (${delta > 0 ? "+" : ""}${(delta * 100).toFixed(1)}%)
Kết quả: ${outcomeStatus}

Trong 2-3 câu ngắn, hãy nhận định: quyết định này đúng hay sai, và bài học rút ra cho lần sau.`;

      const notes = await generateChatCompletion(
        prompt,
        "Bạn là CEO advisor, đưa ra nhận định ngắn gọn và thực tế."
      ).catch(() => `${outcomeStatus}: delta ${(delta * 100).toFixed(1)}%`);

      await prisma.cEODecision.update({
        where: { id: decision.id },
        data: { outcomeAfter: current, outcomeStatus, outcomeNotes: notes },
      });

      insights.push(`[${decision.topic.slice(0, 30)}] → ${outcomeStatus} (${delta > 0 ? "+" : ""}${(delta * 100).toFixed(1)}%)`);
      evaluated++;
    } catch {
      // skip failed evaluations silently
    }
  }

  if (evaluated > 0) {
    const successCount = insights.filter((i) => i.includes("success")).length;
    const failCount = insights.filter((i) => i.includes("fail")).length;

    await prisma.learningInsight.create({
      data: {
        loop: "decision",
        insight: `Đánh giá ${evaluated} quyết định: ${successCount} thành công, ${failCount} thất bại`,
        confidence: 0.9,
        appliedTo: "ceo-memory, council",
      },
    });
  }

  return { evaluated, insights };
}

// Fetch a metric's current value from the DB
async function fetchMetricValue(metric: string): Promise<number | null> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

  if (metric === "revenue") {
    const result = await prisma.bookingRevenue.aggregate({
      where: { paidAt: { gte: thirtyDaysAgo } },
      _sum: { amount: true },
    });
    return result._sum.amount ?? 0;
  }

  if (metric === "leads") {
    return await prisma.lead.count({
      where: { createdAt: { gte: thirtyDaysAgo } },
    });
  }

  if (metric === "engagement") {
    const result = await prisma.postAnalytics.aggregate({
      _avg: { likes: true, comments: true, shares: true },
      where: { post: { publishedAt: { gte: thirtyDaysAgo } } },
    });
    const avg = result._avg;
    return Math.round((avg.likes ?? 0) + (avg.comments ?? 0) * 2 + (avg.shares ?? 0) * 3);
  }

  return null;
}

// Returns decision track record summary for Council system prompt injection
export async function getDecisionTrackRecord(): Promise<string> {
  const decisions = await prisma.cEODecision.findMany({
    where: { outcomeStatus: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { topic: true, outcomeStatus: true, outcomeNotes: true },
  });

  if (decisions.length === 0) return "";

  const lines = decisions.map(
    (d) => `- ${d.topic.slice(0, 50)}: ${d.outcomeStatus}${d.outcomeNotes ? ` (${d.outcomeNotes.slice(0, 80)})` : ""}`
  );

  return `LỊCH SỬ QUYẾT ĐỊNH GẦN ĐÂY:\n${lines.join("\n")}`;
}
