import { prisma } from "./db";
import { generateContent } from "./claude";
import type { CouncilResult } from "./ai-council";

type DecisionSource = "council" | "morning_brief" | "content_research" | "ab_test" | "manual";

function normalizeTopicKey(topic: string): string {
  return topic
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")  // strip Vietnamese diacritics
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .sort()
    .slice(0, 10)
    .join(" ");
}

export async function saveDecision(opts: {
  topic: string;
  context: string;
  council: CouncilResult;
  source?: DecisionSource;
  outcomeMetric?: string;
  outcomeCheckInDays?: number;
}): Promise<{ id: string }> {
  const { topic, context, council, source = "council", outcomeMetric, outcomeCheckInDays } = opts;

  const checkAt = outcomeCheckInDays
    ? new Date(Date.now() + outcomeCheckInDays * 86400000)
    : null;

  // Capture baseline for outcome (revenue-based default)
  let outcomeBefore: number | null = null;
  if (outcomeMetric === "revenue") {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    const result = await prisma.bookingRevenue.aggregate({
      where: { paidAt: { gte: sevenDaysAgo } },
      _sum: { amount: true },
    });
    outcomeBefore = result._sum.amount ?? 0;
  } else if (outcomeMetric === "leads") {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
    outcomeBefore = await prisma.lead.count({ where: { createdAt: { gte: sevenDaysAgo } } });
  }

  const created = await prisma.cEODecision.create({
    data: {
      topic,
      topicKey: normalizeTopicKey(topic),
      context: context.slice(0, 4000),  // cap to avoid huge rows
      synthesis: council.synthesis,
      debate: JSON.stringify(council.turns),
      source,
      outcomeCheckAt: checkAt,
      outcomeMetric: outcomeMetric ?? null,
      outcomeBefore,
      outcomeStatus: checkAt ? "pending" : null,
    },
  });

  return { id: created.id };
}

export async function getRelevantPriorDecisions(topic: string, limit = 3): Promise<{
  topic: string;
  date: Date;
  synthesis: string;
  outcomeStatus: string | null;
  outcomeNotes: string | null;
}[]> {
  const key = normalizeTopicKey(topic);
  if (!key) return [];

  // Find decisions with overlap in topicKey words
  const words = key.split(" ").filter((w) => w.length > 3);
  if (!words.length) return [];

  const all = await prisma.cEODecision.findMany({
    where: {
      OR: words.map((w) => ({ topicKey: { contains: w } })),
    },
    orderBy: { date: "desc" },
    select: { topic: true, date: true, synthesis: true, outcomeStatus: true, outcomeNotes: true, topicKey: true },
    take: 20,
  });

  // Score by word overlap
  const scored = all.map((d) => {
    const dWords = new Set(d.topicKey.split(" "));
    const overlap = words.filter((w) => dWords.has(w)).length;
    return { ...d, _score: overlap };
  }).filter((d) => d._score > 0).sort((a, b) => b._score - a._score);

  return scored.slice(0, limit).map(({ _score, topicKey, ...rest }) => { void _score; void topicKey; return rest; });
}

/**
 * Format prior decisions as context string to inject into council prompts.
 */
export async function formatPriorContext(topic: string): Promise<string> {
  const priors = await getRelevantPriorDecisions(topic, 3);
  if (!priors.length) return "";

  const lines = priors.map((p) => {
    const dStr = p.date.toLocaleDateString("vi-VN");
    const outcome = p.outcomeStatus === "success"
      ? `✓ thành công${p.outcomeNotes ? ` (${p.outcomeNotes.slice(0, 80)})` : ""}`
      : p.outcomeStatus === "fail"
      ? `✗ thất bại${p.outcomeNotes ? ` (${p.outcomeNotes.slice(0, 80)})` : ""}`
      : p.outcomeStatus === "neutral"
      ? `≈ không rõ kết quả`
      : `chưa đánh giá`;
    return `- [${dStr}] "${p.topic.slice(0, 80)}" → ${p.synthesis.slice(0, 120)}... | Outcome: ${outcome}`;
  });

  return `THAM KHẢO CÁC QUYẾT ĐỊNH TRƯỚC VÀ KẾT QUẢ THỰC TẾ:\n${lines.join("\n")}`;
}

/**
 * Background outcome evaluator — run in cron.
 * For each pending decision past outcomeCheckAt, fetch new metric, compare, judge via Claude.
 */
export async function checkPendingOutcomes(): Promise<{ evaluated: number; errors: string[] }> {
  const due = await prisma.cEODecision.findMany({
    where: {
      outcomeStatus: "pending",
      outcomeCheckAt: { lte: new Date() },
    },
    take: 20,
  });

  const errors: string[] = [];
  let evaluated = 0;

  for (const d of due) {
    try {
      let outcomeAfter: number | null = null;

      if (d.outcomeMetric === "revenue") {
        const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
        const result = await prisma.bookingRevenue.aggregate({
          where: { paidAt: { gte: sevenDaysAgo } },
          _sum: { amount: true },
        });
        outcomeAfter = result._sum.amount ?? 0;
      } else if (d.outcomeMetric === "leads") {
        const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
        outcomeAfter = await prisma.lead.count({ where: { createdAt: { gte: sevenDaysAgo } } });
      }

      const before = d.outcomeBefore ?? 0;
      const after = outcomeAfter ?? 0;
      const delta = before > 0 ? (after - before) / before : 0;

      let status: "success" | "fail" | "neutral" = "neutral";
      if (delta > 0.1) status = "success";
      else if (delta < -0.1) status = "fail";

      // Optional: ask Claude to write a 1-sentence reasoning
      let notes = `${d.outcomeMetric}: ${before} → ${after} (${(delta * 100).toFixed(1)}%)`;
      try {
        const prompt = `Quyết định: "${d.topic}"
Hành động đã làm: "${d.synthesis.slice(0, 300)}"
Kết quả ${d.outcomeMetric}: ${before} → ${after} (thay đổi ${(delta * 100).toFixed(1)}%)

Viết 1 câu (max 40 từ): kết quả có do quyết định này không, có nên lặp lại trong tương lai?`;
        const aiNotes = await generateContent(prompt, "Bạn đánh giá ngắn gọn, thực tế.");
        notes = aiNotes.slice(0, 300);
      } catch { /* keep stat-based notes */ }

      await prisma.cEODecision.update({
        where: { id: d.id },
        data: {
          outcomeAfter,
          outcomeStatus: status,
          outcomeNotes: notes,
        },
      });
      evaluated++;
    } catch (e) {
      errors.push(`${d.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { evaluated, errors };
}
