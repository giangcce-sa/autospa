import { prisma } from "./db";
import { generateAnalyticsReport } from "./sub-agents/analytics-agent";
import { generateContentReport } from "./sub-agents/content-report";
import { generateAdsReport } from "./sub-agents/ads-report";
import { generateIntelligenceReport } from "./sub-agents/intelligence-report";
import { councilDebate } from "./ai-council";
import { saveDecision } from "./ceo-memory";

export type WorkflowName = "revenue_drop" | "competitor_surge" | "engagement_drop";

export interface WorkflowStep {
  agent: string;
  label: string;
  output: string;
  status: "completed" | "failed" | "skipped";
  durationMs: number;
}

export interface WorkflowResult {
  id: string;
  name: WorkflowName;
  trigger: string;
  steps: WorkflowStep[];
  plan: string;
  status: "completed" | "failed";
}

async function runStep<T>(
  agent: string,
  label: string,
  fn: () => Promise<T>,
  formatter: (result: T) => string
): Promise<WorkflowStep> {
  const start = Date.now();
  try {
    const result = await fn();
    return {
      agent,
      label,
      output: formatter(result),
      status: "completed",
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      agent,
      label,
      output: e instanceof Error ? e.message : String(e),
      status: "failed",
      durationMs: Date.now() - start,
    };
  }
}

async function ceoSynthesize(workflow: WorkflowName, trigger: string, steps: WorkflowStep[]): Promise<string> {
  const stepsContext = steps.map((s) => `[${s.agent.toUpperCase()}] ${s.label}: ${s.output.slice(0, 400)}`).join("\n\n");

  const council = await councilDebate({
    topic: `Workflow "${workflow}" - Tổng hợp output 4 agent thành kế hoạch hành động`,
    context: `Trigger: ${trigger}\n\nBÁO CÁO TỪ CÁC AGENT:\n${stepsContext}\n\nĐưa ra kế hoạch hành động cụ thể, có thứ tự ưu tiên, giao việc rõ ràng.`,
  });

  await saveDecision({
    topic: `Workflow: ${workflow}`,
    context: trigger,
    council,
    source: "council",
    outcomeMetric: workflow === "revenue_drop" ? "revenue" : "leads",
    outcomeCheckInDays: 7,
  }).catch(() => null);

  return council.synthesis;
}

export async function runRevenueDropWorkflow(trigger: string): Promise<WorkflowResult> {
  const run = await prisma.workflowRun.create({
    data: {
      name: "revenue_drop",
      trigger,
      context: trigger,
      steps: JSON.stringify([]),
    },
  });

  const steps: WorkflowStep[] = [];

  // Step 1: Analytics deep-dive
  steps.push(await runStep("analytics", "Phân tích chi tiết doanh thu 7 ngày",
    () => generateAnalyticsReport("7d"),
    (r) => `${r.summary}\nHighlights: ${r.highlights.join("; ")}\nAnomalies: ${r.anomalies.join("; ")}`
  ));

  // Step 2: Content analyze
  steps.push(await runStep("content", "Đánh giá performance content gần đây",
    () => generateContentReport(),
    (r) => `${r.summary}\nTop: ${r.topPerformers.join("; ")}\nBottom: ${r.underperformers.join("; ")}\nRec: ${r.recommendations.join("; ")}`
  ));

  // Step 3: Ads check
  steps.push(await runStep("ads", "Kiểm tra campaign hiện tại",
    () => generateAdsReport(),
    (r) => `${r.summary}\nAlerts: ${r.alerts.join("; ")}\nRec: ${r.recommendations.join("; ")}`
  ));

  // Step 4: Intelligence — đối thủ có gì
  steps.push(await runStep("intelligence", "Đối thủ có hoạt động bất thường?",
    () => generateIntelligenceReport(),
    (r) => `${r.summary}\nTrends: ${r.trends.join("; ")}\nAlerts: ${r.competitorAlerts.join("; ")}`
  ));

  // Step 5: CEO synthesize
  const plan = await ceoSynthesize("revenue_drop", trigger, steps);

  await prisma.workflowRun.update({
    where: { id: run.id },
    data: {
      steps: JSON.stringify(steps),
      plan,
      status: "completed",
      completedAt: new Date(),
    },
  });

  return { id: run.id, name: "revenue_drop", trigger, steps, plan, status: "completed" };
}

export async function runCompetitorSurgeWorkflow(trigger: string): Promise<WorkflowResult> {
  const run = await prisma.workflowRun.create({
    data: { name: "competitor_surge", trigger, context: trigger, steps: JSON.stringify([]) },
  });

  const steps: WorkflowStep[] = [];

  steps.push(await runStep("intelligence", "Deep dive bài viral đối thủ",
    () => generateIntelligenceReport(),
    (r) => `${r.summary}\nAlerts: ${r.competitorAlerts.join("; ")}\nRec: ${r.recommendations.join("; ")}`
  ));

  steps.push(await runStep("content", "Phân tích content mình tuần qua",
    () => generateContentReport(),
    (r) => `${r.summary}\nRec: ${r.recommendations.join("; ")}`
  ));

  const plan = await ceoSynthesize("competitor_surge", trigger, steps);

  await prisma.workflowRun.update({
    where: { id: run.id },
    data: { steps: JSON.stringify(steps), plan, status: "completed", completedAt: new Date() },
  });

  return { id: run.id, name: "competitor_surge", trigger, steps, plan, status: "completed" };
}

export async function runEngagementDropWorkflow(trigger: string): Promise<WorkflowResult> {
  const run = await prisma.workflowRun.create({
    data: { name: "engagement_drop", trigger, context: trigger, steps: JSON.stringify([]) },
  });

  const steps: WorkflowStep[] = [];

  steps.push(await runStep("content", "Phân tích sentiment + topic mix",
    () => generateContentReport(),
    (r) => `${r.summary}\nTop: ${r.topPerformers.join("; ")}\nBottom: ${r.underperformers.join("; ")}\nRec: ${r.recommendations.join("; ")}`
  ));

  steps.push(await runStep("intelligence", "Đối thủ có trend mới?",
    () => generateIntelligenceReport(),
    (r) => `${r.summary}\nTrends: ${r.trends.join("; ")}`
  ));

  const plan = await ceoSynthesize("engagement_drop", trigger, steps);

  await prisma.workflowRun.update({
    where: { id: run.id },
    data: { steps: JSON.stringify(steps), plan, status: "completed", completedAt: new Date() },
  });

  return { id: run.id, name: "engagement_drop", trigger, steps, plan, status: "completed" };
}

export async function triggerWorkflow(name: WorkflowName, trigger: string): Promise<WorkflowResult> {
  if (name === "revenue_drop") return runRevenueDropWorkflow(trigger);
  if (name === "competitor_surge") return runCompetitorSurgeWorkflow(trigger);
  if (name === "engagement_drop") return runEngagementDropWorkflow(trigger);
  throw new Error(`Unknown workflow: ${name}`);
}
