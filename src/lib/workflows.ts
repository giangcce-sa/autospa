import { prisma } from "./db";
import { generateAnalyticsReport } from "./sub-agents/analytics-agent";
import { generateContentReport } from "./sub-agents/content-report";
import { generateAdsReport } from "./sub-agents/ads-report";
import { generateIntelligenceReport } from "./sub-agents/intelligence-report";
import { councilDebate } from "./ai-council";
import { saveDecision } from "./ceo-memory";
import { getCompetitorContext } from "./learning/competitor-learning";

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

async function persistWorkflowSteps(runId: string, steps: WorkflowStep[]) {
  await prisma.workflowRun.update({
    where: { id: runId },
    data: { steps: JSON.stringify(steps) },
  });
}

async function addWorkflowStep<T>(
  runId: string,
  steps: WorkflowStep[],
  agent: string,
  label: string,
  fn: () => Promise<T>,
  formatter: (result: T) => string,
) {
  const step = await runStep(agent, label, fn, formatter);
  steps.push(step);
  await persistWorkflowSteps(runId, steps);
  return step;
}

async function executeWorkflow(
  name: WorkflowName,
  trigger: string,
  executeStages: (runId: string, steps: WorkflowStep[]) => Promise<void>,
): Promise<WorkflowResult> {
  const run = await prisma.workflowRun.create({
    data: { name, trigger, context: trigger, steps: JSON.stringify([]) },
  });
  const steps: WorkflowStep[] = [];

  try {
    await executeStages(run.id, steps);
    if (steps.some((step) => step.status === "failed")) {
      const plan = "Workflow dừng vì một hoặc nhiều stage thất bại.";
      await prisma.workflowRun.update({
        where: { id: run.id },
        data: { steps: JSON.stringify(steps), plan, status: "failed", completedAt: new Date() },
      });
      return { id: run.id, name, trigger, steps, plan, status: "failed" };
    }

    const council = await addWorkflowStep(
      run.id,
      steps,
      "council",
      "Tổng hợp kế hoạch hành động",
      () => ceoSynthesize(name, trigger, steps),
      (plan) => plan,
    );
    const status = council.status === "completed" ? "completed" : "failed";
    const plan = council.output;
    await prisma.workflowRun.update({
      where: { id: run.id },
      data: { steps: JSON.stringify(steps), plan, status, completedAt: new Date() },
    });
    return { id: run.id, name, trigger, steps, plan, status };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!steps.some((step) => step.status === "failed" && step.output === message)) {
      steps.push({ agent: "workflow", label: "Hoàn tất workflow", output: message, status: "failed", durationMs: 0 });
    }
    await prisma.workflowRun.update({
      where: { id: run.id },
      data: { steps: JSON.stringify(steps), status: "failed", completedAt: new Date() },
    }).catch(() => null);
    throw error;
  }
}

export async function runRevenueDropWorkflow(trigger: string): Promise<WorkflowResult> {
  return executeWorkflow("revenue_drop", trigger, async (runId, steps) => {
    await addWorkflowStep(runId, steps, "analytics", "Phân tích chi tiết doanh thu 7 ngày",
      () => generateAnalyticsReport("7d"),
      (r) => `${r.summary}\nHighlights: ${r.highlights.join("; ")}\nAnomalies: ${r.anomalies.join("; ")}`
    );
    await addWorkflowStep(runId, steps, "content", "Đánh giá performance content gần đây",
      () => generateContentReport(),
      (r) => `${r.summary}\nTop: ${r.topPerformers.join("; ")}\nBottom: ${r.underperformers.join("; ")}\nRec: ${r.recommendations.join("; ")}`
    );
    await addWorkflowStep(runId, steps, "ads", "Kiểm tra campaign hiện tại",
      () => generateAdsReport(),
      (r) => `${r.summary}\nAlerts: ${r.alerts.join("; ")}\nRec: ${r.recommendations.join("; ")}`
    );
    await addWorkflowStep(runId, steps, "intelligence", "Đối thủ có hoạt động bất thường?",
      () => generateIntelligenceReport(),
      (r) => `${r.summary}\nTrends: ${r.trends.join("; ")}\nAlerts: ${r.competitorAlerts.join("; ")}`
    );
  });
}

export async function runCompetitorSurgeWorkflow(trigger: string): Promise<WorkflowResult> {
  return executeWorkflow("competitor_surge", trigger, async (runId, steps) => {
    const competitorCtx = await getCompetitorContext();
    await prisma.workflowRun.update({
      where: { id: runId },
      data: { context: `${trigger}\n${competitorCtx.insight}` },
    });
    await addWorkflowStep(runId, steps, "intelligence", "Deep dive bài viral đối thủ",
      () => generateIntelligenceReport(),
      (r) => `${r.summary}\nMemory: ${competitorCtx.insight || "chưa có"}\nAlerts: ${r.competitorAlerts.join("; ")}\nRec: ${[...competitorCtx.recommendations, ...r.recommendations].slice(0, 5).join("; ")}`
    );
    await addWorkflowStep(runId, steps, "content", "Phân tích content mình tuần qua",
      () => generateContentReport(),
      (r) => `${r.summary}\nRec: ${r.recommendations.join("; ")}`
    );
  });
}

export async function runEngagementDropWorkflow(trigger: string): Promise<WorkflowResult> {
  return executeWorkflow("engagement_drop", trigger, async (runId, steps) => {
    await addWorkflowStep(runId, steps, "content", "Phân tích sentiment + topic mix",
      () => generateContentReport(),
      (r) => `${r.summary}\nTop: ${r.topPerformers.join("; ")}\nBottom: ${r.underperformers.join("; ")}\nRec: ${r.recommendations.join("; ")}`
    );
    await addWorkflowStep(runId, steps, "intelligence", "Đối thủ có trend mới?",
      () => generateIntelligenceReport(),
      (r) => `${r.summary}\nTrends: ${r.trends.join("; ")}`
    );
  });
}

export async function triggerWorkflow(name: WorkflowName, trigger: string): Promise<WorkflowResult> {
  if (name === "revenue_drop") return runRevenueDropWorkflow(trigger);
  if (name === "competitor_surge") return runCompetitorSurgeWorkflow(trigger);
  if (name === "engagement_drop") return runEngagementDropWorkflow(trigger);
  throw new Error(`Unknown workflow: ${name}`);
}
