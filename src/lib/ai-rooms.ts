import "server-only";

import { BRAIN_TAXONOMY, isBrainDomain, safeJsonParse } from "@/lib/brain-taxonomy";
import { prisma } from "@/lib/db";
import {
  isOutcomeStatus,
  parseJsonRecord,
  parseOrchestratorActions,
  parseOrchestratorPriorities,
  parseOrchestratorSignals,
  parseWorkflowSteps,
} from "@/lib/ai-runtime-types";
import { getAllQuotas } from "@/lib/rate-limiter";
import { toAutomationSettingsDto } from "@/lib/settings/automation-policy";

export interface AIRoomsProvenance {
  scope: "account";
  source: string;
  asOf: string;
  warning?: string;
}

export interface AIRoomDecision {
  id: string;
  topic: string;
  synthesis: string;
  source: string;
  outcomeMetric: string | null;
  outcomeBefore: number | null;
  outcomeAfter: number | null;
  outcomeStatus: string | null;
  outcomeNotes: string | null;
  createdAt: string;
}

export interface AIRoomBrainSkill {
  id: string;
  name: string;
  description: string | null;
  domain: string;
  category: string;
  tags: string[];
  inputSignals: string[];
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  playbook: string;
  tools: string[];
  successMetric: string | null;
  permissionLevel: string;
  riskLevel: string;
  confidence: number;
  classificationConfidence: number;
  status: string;
  learnedFrom: string;
  councilNotes: string | null;
  latestRun: AIRoomBrainRun | null;
  latestOutcome: AIRoomBrainOutcome | null;
  versionCount: number;
  feedbackCount: number;
  updatedAt: string;
}

export interface AIRoomBrainRun {
  id: string;
  skillId: string;
  skillName: string;
  action: string;
  status: string;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface AIRoomBrainOutcome {
  id: string;
  skillId: string;
  skillName: string;
  metric: string;
  status: string;
  deltaPct: number | null;
  confidenceDelta: number;
  notes: string | null;
  createdAt: string;
}

export interface AIRoomOrchestratorRun {
  id: string;
  mode: string;
  signals: ReturnType<typeof parseOrchestratorSignals>;
  priorities: ReturnType<typeof parseOrchestratorPriorities>;
  actions: ReturnType<typeof parseOrchestratorActions>;
  available: boolean;
  runAt: string;
}

export interface AIRoomWorkflowRun {
  id: string;
  name: string;
  trigger: string;
  status: string;
  plan: string | null;
  steps: ReturnType<typeof parseWorkflowSteps>;
  startedAt: string;
  completedAt: string | null;
}

export interface AIRoomRealtimeAlert {
  id: string;
  type: string;
  signal: string;
  severity: string;
  acknowledged: boolean;
  workflowRunId: string | null;
  detectedAt: string;
}

export interface AIRoomQuota {
  key: string;
  used: number;
  limit: number;
  pct: number;
  windowEndsIn: number;
}

export interface AIRoomApproval {
  id: string;
  type: string;
  status: string;
  effectiveStatus: string;
  shortCode: string;
  summary: string | null;
  decidedAt: string | null;
  executedAt: string | null;
  executionError: string | null;
  timeoutAt: string;
  createdAt: string;
}

export interface AIRoomJobRun {
  id: string;
  name: string;
  status: string;
  trigger: string;
  summary: string | null;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
}

const decisionSelect = {
  id: true,
  topic: true,
  synthesis: true,
  source: true,
  outcomeMetric: true,
  outcomeBefore: true,
  outcomeAfter: true,
  outcomeStatus: true,
  outcomeNotes: true,
  createdAt: true,
} as const;

const approvalSelect = {
  id: true,
  type: true,
  payload: true,
  status: true,
  shortCode: true,
  decidedAt: true,
  executedAt: true,
  executionError: true,
  timeoutAt: true,
  createdAt: true,
} as const;

const jobSelect = {
  id: true,
  name: true,
  status: true,
  trigger: true,
  summary: true,
  error: true,
  startedAt: true,
  completedAt: true,
} as const;

export async function getAIRoomCounts(now = new Date()) {
  const [decisions, activeSkills, pendingApprovals, runningWorkflows] = await Promise.all([
    prisma.cEODecision.count(),
    prisma.brainSkill.count({ where: { status: "active" } }),
    prisma.pendingApproval.count({ where: { status: "pending", timeoutAt: { gt: now } } }),
    prisma.workflowRun.count({ where: { status: "running" } }),
  ]);
  return { decisions, activeSkills, pendingApprovals, runningWorkflows };
}

export async function getAIRoomsOverview() {
  const now = new Date();
  const [counts, recentDecisions, recentApprovals, recentJobs] = await Promise.all([
    getAIRoomCounts(now),
    prisma.cEODecision.findMany({ orderBy: { createdAt: "desc" }, take: 5, select: decisionSelect }),
    prisma.pendingApproval.findMany({ orderBy: { createdAt: "desc" }, take: 5, select: approvalSelect }),
    prisma.jobRun.findMany({ orderBy: { startedAt: "desc" }, take: 5, select: jobSelect }),
  ]);

  return {
    provenance: provenance("CEODecision, BrainSkill, PendingApproval, WorkflowRun và JobRun persisted", now),
    counts,
    recentDecisions: recentDecisions.map(serializeDecision),
    recentApprovals: recentApprovals.map((approval) => serializeApproval(approval, now)),
    recentJobs: recentJobs.map(serializeJob),
  };
}

export async function getAIRoomCouncilData() {
  const now = new Date();
  const [total, decisions] = await Promise.all([
    prisma.cEODecision.count({ where: { source: "council" } }),
    prisma.cEODecision.findMany({ where: { source: "council" }, orderBy: { createdAt: "desc" }, take: 20, select: decisionSelect }),
  ]);
  return {
    provenance: provenance("CEODecision source=council", now, "Mỗi record là một kết quả Council đã persist; schema chưa có agenda, participant hoặc evidence session chuẩn hóa."),
    total,
    decisions: decisions.map(serializeDecision),
  };
}

const BRAIN_STATUSES = ["draft", "active", "paused", "deprecated"] as const;
const BRAIN_RISKS = ["low", "medium", "high"] as const;

export interface AIRoomBrainFilters {
  domain?: string;
  category?: string;
  status?: string;
  risk?: string;
  q?: string;
}

export async function getAIRoomBrainData(filters: AIRoomBrainFilters = {}) {
  const invalidDomain = Boolean(filters.domain && !isBrainDomain(filters.domain));
  const domain = filters.domain && isBrainDomain(filters.domain) ? filters.domain : undefined;
  const invalidCategory = Boolean(filters.category && (!domain || !BRAIN_TAXONOMY[domain].categories.includes(filters.category)));
  const category = domain && BRAIN_TAXONOMY[domain].categories.includes(filters.category ?? "")
    ? filters.category
    : undefined;
  const invalidStatus = Boolean(filters.status && !BRAIN_STATUSES.includes(filters.status as typeof BRAIN_STATUSES[number]));
  const status = BRAIN_STATUSES.includes(filters.status as typeof BRAIN_STATUSES[number]) ? filters.status : undefined;
  const invalidRisk = Boolean(filters.risk && !BRAIN_RISKS.includes(filters.risk as typeof BRAIN_RISKS[number]));
  const risk = BRAIN_RISKS.includes(filters.risk as typeof BRAIN_RISKS[number]) ? filters.risk : undefined;
  const q = filters.q?.trim().slice(0, 100) || undefined;
  const invalidFilter = invalidDomain || invalidCategory || invalidStatus || invalidRisk;
  const where = invalidFilter
    ? { id: "__invalid_brain_filter__" }
    : {
        ...(domain && { domain }),
        ...(category && { category }),
        ...(status && { status }),
        ...(risk && { riskLevel: risk }),
        ...(q && { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { description: { contains: q, mode: "insensitive" as const } }] }),
      };
  const now = new Date();
  const [total, active, draft, highRisk, filtered, skills, runs, outcomes, domainGroups] = await Promise.all([
    prisma.brainSkill.count(),
    prisma.brainSkill.count({ where: { status: "active" } }),
    prisma.brainSkill.count({ where: { status: "draft" } }),
    prisma.brainSkill.count({ where: { riskLevel: "high" } }),
    prisma.brainSkill.count({ where }),
    prisma.brainSkill.findMany({
      where,
      orderBy: [{ confidence: "desc" }, { updatedAt: "desc" }],
      take: 100,
      include: {
        runs: { orderBy: { startedAt: "desc" }, take: 1, include: { skill: { select: { name: true } } } },
        outcomes: { orderBy: { createdAt: "desc" }, take: 1, include: { skill: { select: { name: true } } } },
        _count: { select: { versions: true, feedback: true } },
      },
    }),
    prisma.brainSkillRun.findMany({
      where: domain ? { skill: { domain } } : undefined,
      orderBy: { startedAt: "desc" },
      take: 30,
      select: { id: true, skillId: true, action: true, status: true, error: true, startedAt: true, completedAt: true, skill: { select: { name: true } } },
    }),
    prisma.brainSkillOutcome.findMany({
      where: domain ? { skill: { domain } } : undefined,
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, skillId: true, metric: true, status: true, deltaPct: true, confidenceDelta: true, notes: true, createdAt: true, skill: { select: { name: true } } },
    }),
    prisma.brainSkill.groupBy({ by: ["domain", "status"], _count: { _all: true } }),
  ]);
  const serializeRun = (run: typeof runs[number]): AIRoomBrainRun => ({
    id: run.id,
    skillId: run.skillId,
    skillName: run.skill.name,
    action: run.action,
    status: run.status,
    error: run.error,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
  });
  const serializeOutcome = (outcome: typeof outcomes[number]): AIRoomBrainOutcome => ({
    id: outcome.id,
    skillId: outcome.skillId,
    skillName: outcome.skill.name,
    metric: outcome.metric,
    status: outcome.status,
    deltaPct: outcome.deltaPct,
    confidenceDelta: outcome.confidenceDelta,
    notes: outcome.notes,
    createdAt: outcome.createdAt.toISOString(),
  });
  const map = Object.values(BRAIN_TAXONOMY).map((meta) => {
    const groups = domainGroups.filter((group) => group.domain === meta.domain);
    return {
      ...meta,
      total: groups.reduce((sum, group) => sum + group._count._all, 0),
      active: groups.find((group) => group.status === "active")?._count._all ?? 0,
      draft: groups.find((group) => group.status === "draft")?._count._all ?? 0,
    };
  });

  return {
    provenance: provenance("BrainSkill, BrainSkillRun, BrainSkillOutcome, version và feedback persisted", now),
    taxonomy: BRAIN_TAXONOMY,
    map,
    filters: { domain: domain ?? null, category: category ?? null, status: status ?? null, risk: risk ?? null, q: q ?? null, invalid: invalidFilter },
    counts: { total, active, draft, highRisk, filtered },
    skills: skills.map((skill): AIRoomBrainSkill => ({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      domain: skill.domain,
      category: skill.category,
      tags: safeJsonParse(skill.tags, []),
      inputSignals: safeJsonParse(skill.inputSignals, []),
      triggerType: skill.triggerType,
      triggerConfig: safeJsonParse(skill.triggerConfig, {}),
      playbook: skill.playbook,
      tools: safeJsonParse(skill.tools, []),
      successMetric: skill.successMetric,
      permissionLevel: skill.permissionLevel,
      riskLevel: skill.riskLevel,
      confidence: skill.confidence,
      classificationConfidence: skill.classificationConfidence,
      status: skill.status,
      learnedFrom: skill.learnedFrom,
      councilNotes: skill.councilNotes,
      latestRun: skill.runs[0] ? serializeRun(skill.runs[0]) : null,
      latestOutcome: skill.outcomes[0] ? serializeOutcome(skill.outcomes[0]) : null,
      versionCount: skill._count.versions,
      feedbackCount: skill._count.feedback,
      updatedAt: skill.updatedAt.toISOString(),
    })),
    runs: runs.map(serializeRun),
    outcomes: outcomes.map(serializeOutcome),
  };
}

export async function getAIRoomMemoryData(status?: string) {
  const allowedStatus = isOutcomeStatus(status) ? status : undefined;
  const where = allowedStatus ? { outcomeStatus: allowedStatus } : undefined;
  const now = new Date();
  const [total, success, fail, neutral, pending, decisions] = await Promise.all([
    prisma.cEODecision.count(),
    prisma.cEODecision.count({ where: { outcomeStatus: "success" } }),
    prisma.cEODecision.count({ where: { outcomeStatus: "fail" } }),
    prisma.cEODecision.count({ where: { outcomeStatus: "neutral" } }),
    prisma.cEODecision.count({ where: { outcomeStatus: "pending" } }),
    prisma.cEODecision.findMany({ where, orderBy: { createdAt: "desc" }, take: 50, select: decisionSelect }),
  ]);
  return {
    provenance: provenance("CEODecision persisted", now, "Outcome phản ánh trạng thái đã lưu; không chứng minh attribution nhân quả nếu record không có metric và baseline đầy đủ."),
    counts: { total, success, fail, neutral, pending },
    filter: allowedStatus ?? null,
    decisions: decisions.map(serializeDecision),
  };
}

export async function getAIRoomOrchestratorData(canReadOwnerData = false) {
  const now = new Date();
  const [latest, workflowTotal, runningWorkflowCount, workflows, jobs, settings, ownerData] = await Promise.all([
    prisma.orchestratorRun.findFirst({ orderBy: { runAt: "desc" }, select: { id: true, mode: true, signals: true, priorities: true, actions: true, runAt: true } }),
    prisma.workflowRun.count(),
    prisma.workflowRun.count({ where: { status: "running" } }),
    prisma.workflowRun.findMany({ orderBy: { startedAt: "desc" }, take: 30, select: { id: true, name: true, trigger: true, status: true, plan: true, steps: true, startedAt: true, completedAt: true } }),
    prisma.jobRun.findMany({ orderBy: { startedAt: "desc" }, take: 30, select: jobSelect }),
    prisma.settings.findFirst({ select: { automationLevel: true } }),
    canReadOwnerData ? getAIRoomOrchestratorOwnerData() : null,
  ]);
  const automationLevel = toAutomationSettingsDto(settings).automationLevel;
  const executionWarning = automationLevel === "supervised"
    ? "Supervised chỉ tạo đề xuất và Brain run draft/queued; không tự thực thi agent low-risk."
    : automationLevel === "semi"
      ? "Semi có thể chạy workflow và agent low-risk khi owner hoặc cron kích hoạt Orchestrator."
      : "Full có thể chạy workflow và agent được hỗ trợ khi owner hoặc cron kích hoạt Orchestrator.";

  return {
    provenance: provenance("OrchestratorRun, WorkflowRun và JobRun persisted", now, "Đọc workspace không chạy orchestrator, workflow, monitor hoặc quota mutation. Action chỉ phản ánh nội dung đã persist trong từng run."),
    latest: latest ? serializeOrchestrator(latest) : null,
    workflowTotal,
    runningWorkflowCount,
    automationLevel,
    executionWarning,
    workflows: workflows.map(serializeWorkflow),
    jobs: jobs.map(serializeJob),
    ownerData,
  };
}

export async function getAIRoomApprovalsData() {
  const now = new Date();
  const [activePending, expiredPending, approved, rejected, approvals] = await Promise.all([
    prisma.pendingApproval.count({ where: { status: "pending", timeoutAt: { gt: now } } }),
    prisma.pendingApproval.count({ where: { status: "pending", timeoutAt: { lte: now } } }),
    prisma.pendingApproval.count({ where: { status: "approved" } }),
    prisma.pendingApproval.count({ where: { status: "rejected" } }),
    prisma.pendingApproval.findMany({ orderBy: { createdAt: "desc" }, take: 50, select: approvalSelect }),
  ]);

  return {
    provenance: provenance("PendingApproval persisted", now, "Approval pending đã quá timeout được hiển thị là timed_out hiệu lực; GET không cập nhật database."),
    counts: { pending: activePending, timedOut: expiredPending, approved, rejected },
    approvals: approvals.map((approval) => serializeApproval(approval, now)),
  };
}

async function getAIRoomOrchestratorOwnerData() {
  const [alerts, unacknowledged, quotas] = await Promise.all([
    prisma.realtimeAlert.findMany({
      orderBy: { detectedAt: "desc" },
      take: 30,
      select: { id: true, type: true, signal: true, severity: true, acknowledged: true, workflowRunId: true, detectedAt: true },
    }),
    prisma.realtimeAlert.count({ where: { acknowledged: false } }),
    getAllQuotas(),
  ]);

  return {
    alerts: alerts.map((alert): AIRoomRealtimeAlert => ({
      ...alert,
      detectedAt: alert.detectedAt.toISOString(),
    })),
    unacknowledged,
    quotas: quotas satisfies AIRoomQuota[],
  };
}

function provenance(source: string, now: Date, warning?: string): AIRoomsProvenance {
  return { scope: "account", source, asOf: now.toISOString(), warning };
}

function serializeDecision(decision: {
  id: string;
  topic: string;
  synthesis: string;
  source: string;
  outcomeMetric: string | null;
  outcomeBefore: number | null;
  outcomeAfter: number | null;
  outcomeStatus: string | null;
  outcomeNotes: string | null;
  createdAt: Date;
}): AIRoomDecision {
  return {
    id: decision.id,
    topic: decision.topic,
    synthesis: decision.synthesis,
    source: decision.source,
    outcomeMetric: decision.outcomeMetric,
    outcomeBefore: decision.outcomeBefore,
    outcomeAfter: decision.outcomeAfter,
    outcomeStatus: decision.outcomeStatus,
    outcomeNotes: decision.outcomeNotes,
    createdAt: decision.createdAt.toISOString(),
  };
}

function serializeOrchestrator(run: { id: string; mode: string; signals: string; priorities: string; actions: string; runAt: Date }): AIRoomOrchestratorRun {
  const signals = parseOrchestratorSignals(run.signals);
  const priorities = parseOrchestratorPriorities(run.priorities);
  const actions = parseOrchestratorActions(run.actions);
  const validMode = run.mode === "recommend" || run.mode === "auto";
  return {
    id: run.id,
    mode: validMode ? run.mode : "unavailable",
    signals,
    priorities,
    actions,
    available: validMode && signals !== null && priorities !== null && actions !== null,
    runAt: run.runAt.toISOString(),
  };
}

function serializeWorkflow(run: { id: string; name: string; trigger: string; status: string; plan: string | null; steps: string; startedAt: Date; completedAt: Date | null }): AIRoomWorkflowRun {
  return {
    id: run.id,
    name: run.name,
    trigger: run.trigger,
    status: run.status,
    plan: run.plan,
    steps: parseWorkflowSteps(run.steps),
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
  };
}

function serializeApproval(approval: { id: string; type: string; payload: string; status: string; shortCode: string; decidedAt: Date | null; executedAt: Date | null; executionError: string | null; timeoutAt: Date; createdAt: Date }, now: Date): AIRoomApproval {
  const payload = parseJsonRecord(approval.payload);
  const campaignName = typeof payload.campaignName === "string" ? payload.campaignName : null;
  const action = typeof payload.action === "string" ? payload.action : null;
  const summary = campaignName && action ? `${campaignName} · ${action}` : campaignName ?? action;
  const effectiveStatus = approval.status === "pending" && approval.timeoutAt <= now ? "timed_out" : approval.status;
  return {
    id: approval.id,
    type: approval.type,
    status: approval.status,
    effectiveStatus,
    shortCode: approval.shortCode,
    summary,
    decidedAt: approval.decidedAt?.toISOString() ?? null,
    executedAt: approval.executedAt?.toISOString() ?? null,
    executionError: approval.executionError,
    timeoutAt: approval.timeoutAt.toISOString(),
    createdAt: approval.createdAt.toISOString(),
  };
}

function serializeJob(job: { id: string; name: string; status: string; trigger: string; summary: string | null; error: string | null; startedAt: Date; completedAt: Date | null }): AIRoomJobRun {
  return {
    id: job.id,
    name: job.name,
    status: job.status,
    trigger: job.trigger,
    summary: job.summary,
    error: job.error,
    startedAt: job.startedAt.toISOString(),
    completedAt: job.completedAt?.toISOString() ?? null,
  };
}
