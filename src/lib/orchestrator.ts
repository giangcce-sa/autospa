import { prisma } from "./db";
import { computeForecast } from "./forecast";
import { councilDebate } from "./ai-council";
import { runProactiveOutreach } from "./proactive-sales";
import { triggerWorkflow } from "./workflows";
import { getCompetitorContext } from "./learning/competitor-learning";
import {
  AGENT_DOMAIN,
  pickWorkflowForSignal,
  scoreAgents,
  type AgentKey,
  type AgentPriority,
  type SignalSnapshot,
} from "./orchestrator-policy";

export type { AgentKey, AgentPriority, SignalSnapshot } from "./orchestrator-policy";

export interface OrchestratorPlan {
  signals: SignalSnapshot;
  priorities: AgentPriority[];
  actions: { agent: AgentKey; action: string; status: "executed" | "queued" | "skipped"; result?: unknown }[];
  mode: "recommend" | "auto";
}

async function gatherSignals(): Promise<SignalSnapshot> {
  const now = new Date();
  const day = 86400000;
  const last7Start = new Date(now.getTime() - 7 * day);
  const prev7Start = new Date(now.getTime() - 14 * day);
  const day14ago = new Date(now.getTime() - 14 * day);
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrow); tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
  const hours24Ago = new Date(now.getTime() - 86400000);

  const [
    rev7, revPrev7,
    hotLeads, coldLeads, newLeads,
    unreadInbox, negComments,
    pendingApprovals,
    schedTomorrow,
    posts7, posts14prior,
    competitorPosts,
    forecastNext,
    failedDecisions,
  ] = await Promise.all([
    prisma.bookingRevenue.aggregate({ where: { paidAt: { gte: last7Start } }, _sum: { amount: true } }),
    prisma.bookingRevenue.aggregate({ where: { paidAt: { gte: prev7Start, lt: last7Start } }, _sum: { amount: true } }),
    prisma.lead.count({ where: { stage: "hot" } }),
    prisma.lead.count({ where: { stage: "cold", nurtureStep: { gte: 3 } } }),
    prisma.lead.count({ where: { createdAt: { gte: new Date(now.getTime() - day) } } }),
    prisma.inboxMessage.count({ where: { isRead: false } }),
    prisma.postComment.count({ where: { isAlert: true, isReplied: false } }),
    prisma.pendingApproval.count({ where: { status: "pending", createdAt: { lte: hours24Ago } } }),
    prisma.post.count({ where: { status: "scheduled", scheduledAt: { gte: tomorrow, lt: tomorrowEnd } } }),
    prisma.post.findMany({
      where: { status: "published", publishedAt: { gte: last7Start } },
      include: { analytics: true },
    }),
    prisma.post.findMany({
      where: { status: "published", publishedAt: { gte: day14ago, lt: last7Start } },
      include: { analytics: true },
    }),
    prisma.competitorPost.findMany({
      where: { publishedAt: { gte: last7Start } },
      orderBy: { likes: "desc" },
      take: 3,
    }),
    computeForecast({ horizonDays: 7, scenario: "baseline", save: false, useCouncil: false }).catch(() => ({ total: 0, days: [] })),
    prisma.cEODecision.count({ where: { outcomeStatus: "fail", date: { gte: new Date(now.getTime() - 30 * day) } } }),
  ]);

  const revenue7 = rev7._sum.amount ?? 0;
  const revenuePrev7 = revPrev7._sum.amount ?? 0;
  const revDelta = revenuePrev7 > 0 ? (revenue7 - revenuePrev7) / revenuePrev7 : 0;

  const engScore = (p: typeof posts7[0]) => (p.analytics?.likes ?? 0) + (p.analytics?.comments ?? 0) * 2 + (p.analytics?.shares ?? 0) * 3;
  const eng7avg = posts7.length ? posts7.reduce((s, p) => s + engScore(p), 0) / posts7.length : 0;
  const eng14avg = posts14prior.length ? posts14prior.reduce((s, p) => s + engScore(p), 0) / posts14prior.length : 0;

  const compSurge = competitorPosts.filter((p) => p.likes > 500).length;
  const topComp = competitorPosts[0]?.fbPostId ?? null;

  const next7 = forecastNext.total ?? 0;
  const histAvgDaily = revenue7 / 7;
  const vsAvg = histAvgDaily > 0 ? (next7 / 7 - histAvgDaily) / histAvgDaily : 0;

  return {
    revenue: { last7: revenue7, prev7: revenuePrev7, deltaPct: revDelta },
    leads: { hotUnclosed: hotLeads, coldNoNurture: coldLeads, newToday: newLeads },
    inbox: { unread: unreadInbox },
    comments: { negativeUnreplied: negComments },
    approvals: { pendingOver24h: pendingApprovals },
    posts: { scheduledTomorrow: schedTomorrow, engagement7dAvg: eng7avg, engagement14dPriorAvg: eng14avg },
    competitor: { surgeCount: compSurge, topPostId: topComp },
    forecast: { next7Predicted: next7, vsAverage: vsAvg },
    pendingDecisionFails: failedDecisions,
  };
}

async function executeIntelligenceAgent(s: SignalSnapshot): Promise<unknown> {
  if (!s.competitor.topPostId) return { skipped: "no competitor data" };
  const topCompPost = await prisma.competitorPost.findUnique({
    where: { fbPostId: s.competitor.topPostId },
    include: { competitor: { select: { name: true } } },
  });
  if (!topCompPost) return { skipped: "competitor post not found" };
  const competitorCtx = await getCompetitorContext();

  const council = await councilDebate({
    topic: "Đối thủ vừa có bài viral — mình nên phản hồi thế nào?",
    context: `Đối thủ ${topCompPost.competitor.name} có bài (${topCompPost.likes} likes, ${topCompPost.comments} comments):
"${topCompPost.message}"

Competitor Memory:
${competitorCtx.insight || "Chưa có memory dài hạn"}
${competitorCtx.recommendations.length ? `Gợi ý phản ứng: ${competitorCtx.recommendations.join(" | ")}` : ""}

Đề xuất hướng content của mình để không bị tụt lại nhưng KHÔNG copy đối thủ. Chỉ tạo draft, không đăng tự động.`,
  });

  // Save as Post draft with INTEL: prefix
  await prisma.post.create({
    data: {
      caption: council.synthesis.slice(0, 2000),
      hashtags: "",
      status: "draft",
      platform: "facebook",
      postType: "service",
      tone: "friendly",
      qualityNotes: `INTEL: phản hồi đối thủ ${topCompPost.competitor.name}`,
    },
  });

  return { generated: true, councilTurns: council.turns.length };
}

async function decideActions(priorities: AgentPriority[], automationLevel: string, signals?: SignalSnapshot): Promise<OrchestratorPlan["actions"]> {
  const actions: OrchestratorPlan["actions"] = [];

  // Auto-trigger chained workflow on critical signal (full or semi mode)
  if (signals && automationLevel !== "supervised") {
    const wf = pickWorkflowForSignal(signals);
    if (wf) {
      try {
        const result = await triggerWorkflow(wf.name, wf.trigger);
        actions.push({
          agent: "ads_creative" as AgentKey,
          action: `Chained workflow ${wf.name} (${result.steps.length} steps): ${result.plan.slice(0, 200)}`,
          status: result.status === "completed" ? "executed" : "skipped",
          result: { workflowId: result.id, name: wf.name, status: result.status },
        });
      } catch (e) {
        actions.push({ agent: "ads_creative" as AgentKey, action: `Workflow ${wf.name}`, status: "skipped", result: String(e) });
      }
    }
  }

  const top = priorities.slice(0, 3);

  for (const p of top) {
    // Low-risk: auto execute in semi/full mode
    const lowRisk = ["intelligence", "proactive_sales"].includes(p.agent);
    const shouldExecute =
      automationLevel === "full" ||
      (automationLevel === "semi" && lowRisk);

    if (!shouldExecute) {
      actions.push({ agent: p.agent, action: p.recommendedAction, status: "queued" });
      continue;
    }

    try {
      let result: unknown;
      if (p.agent === "intelligence") {
        // Lazy gather competitor signal again (cheap re-read)
        const s = await gatherSignals();
        result = await executeIntelligenceAgent(s);
      } else if (p.agent === "proactive_sales") {
        result = await runProactiveOutreach();
      } else {
        actions.push({ agent: p.agent, action: p.recommendedAction, status: "queued" });
        continue;
      }
      actions.push({ agent: p.agent, action: p.recommendedAction, status: "executed", result });
    } catch (e) {
      actions.push({ agent: p.agent, action: p.recommendedAction, status: "skipped", result: String(e) });
    }
  }

  if (priorities.length > 0) {
    const domains = [...new Set(priorities.map((p) => AGENT_DOMAIN[p.agent]))].filter(Boolean);
    const activeSkills = await prisma.brainSkill.findMany({
      where: {
        status: "active",
        domain: { in: domains },
      },
      orderBy: [{ confidence: "desc" }, { updatedAt: "desc" }],
      take: 6,
    });

    for (const skill of activeSkills) {
      const priority = priorities.find((p) => AGENT_DOMAIN[p.agent] === skill.domain);
      if (!priority) continue;
      const action = `Brain skill "${skill.name}" match tín hiệu: ${priority.reason}`;
      const run = await prisma.brainSkillRun.create({
        data: {
          skillId: skill.id,
          signal: JSON.stringify({ priority, signals }),
          action,
          status: skill.permissionLevel === "suggest" ? "queued" : "drafted",
          result: JSON.stringify({
            permissionLevel: skill.permissionLevel,
            playbook: skill.playbook.slice(0, 800),
          }),
        },
      });
      actions.push({
        agent: priority.agent,
        action,
        status: "queued",
        result: { brainSkillId: skill.id, brainSkillRunId: run.id, permissionLevel: skill.permissionLevel },
      });
    }
  }

  return actions;
}

export async function runOrchestrator(): Promise<OrchestratorPlan> {
  const settings = await prisma.settings.findFirst();
  const automationLevel = settings?.automationLevel ?? "supervised";

  const signals = await gatherSignals();
  const priorities = scoreAgents(signals);
  const actions = await decideActions(priorities, automationLevel, signals);

  const plan: OrchestratorPlan = {
    signals,
    priorities,
    actions,
    mode: automationLevel === "supervised" ? "recommend" : "auto",
  };

  // Save run
  await prisma.orchestratorRun.create({
    data: {
      signals: JSON.stringify(signals),
      priorities: JSON.stringify(priorities),
      actions: JSON.stringify(actions),
      mode: plan.mode,
    },
  });

  return plan;
}
