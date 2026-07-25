import { getCanonicalRouteHref } from "@/config/routes";
import { prisma } from "./db";
import { runDailyStandup } from "./daily-standup";
import { businessDateKey } from "./today-policy";

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
  all: getCanonicalRouteHref("orchestrator"),
};

export async function getMorningBrief(now = new Date()) {
  return prisma.morningBrief.findUnique({ where: { date: businessDateKey(now) } });
}

export async function generateMorningBrief() {
  const dateStr = businessDateKey();
  const existing = await prisma.morningBrief.findUnique({ where: { date: dateStr } });
  if (existing) return existing;

  // Run the 4-agent standup
  const standup = await runDailyStandup();

  // Convert assignments → BriefAction (for compat with old MorningBriefCard)
  const actions: BriefAction[] = standup.assignments.map((a) => ({
    label: a.task,
    href: AGENT_HREF[a.agent] ?? getCanonicalRouteHref("orchestrator"),
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
