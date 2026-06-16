import { prisma } from "./db";
import { runDailyStandup } from "./daily-standup";

export interface BriefAction {
  label: string;
  href: string;
  priority: "high" | "medium" | "low";
  reason?: string;
}

const AGENT_HREF: Record<string, string> = {
  content: "/content-research",
  ads: "/facebook-ads",
  sales: "/sale",
  intelligence: "/competitors",
  all: "/orchestrator",
};

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Multi-agent Daily Standup brief.
 * Idempotent: returns existing if generated today.
 */
export async function generateMorningBrief() {
  const dateStr = todayKey();
  const existing = await prisma.morningBrief.findUnique({ where: { date: dateStr } });
  if (existing) return existing;

  // Run the 4-agent standup
  const standup = await runDailyStandup();

  // Convert assignments → BriefAction (for compat with old MorningBriefCard)
  const actions: BriefAction[] = standup.assignments.map((a) => ({
    label: a.task,
    href: AGENT_HREF[a.agent] ?? "/orchestrator",
    priority: a.priority,
    reason: `[${a.agent.toUpperCase()}]`,
  }));

  return prisma.morningBrief.create({
    data: {
      date: dateStr,
      summary: standup.ceoSummary,
      actions: JSON.stringify(actions),
      debate: JSON.stringify(standup.debate),
      subReports: JSON.stringify(standup.subReports),
      assignments: JSON.stringify(standup.assignments),
    },
  });
}
