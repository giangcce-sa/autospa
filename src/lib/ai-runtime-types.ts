import type { AgentKey, AgentPriority, OrchestratorPlan, SignalSnapshot } from "@/lib/orchestrator";
import type { WorkflowName, WorkflowStep } from "@/lib/workflows";

export const WORKFLOW_NAMES = ["revenue_drop", "competitor_surge", "engagement_drop"] as const satisfies readonly WorkflowName[];
export const OUTCOME_STATUSES = ["success", "fail", "neutral", "pending"] as const;
export const OVERRIDABLE_OUTCOME_STATUSES = ["success", "fail", "neutral"] as const;

export type OutcomeStatus = typeof OUTCOME_STATUSES[number];
export type OverridableOutcomeStatus = typeof OVERRIDABLE_OUTCOME_STATUSES[number];

export function isWorkflowName(value: unknown): value is WorkflowName {
  return typeof value === "string" && WORKFLOW_NAMES.some((name) => name === value);
}

export function isOutcomeStatus(value: unknown): value is OutcomeStatus {
  return typeof value === "string" && OUTCOME_STATUSES.some((status) => status === value);
}

export function isOverridableOutcomeStatus(value: unknown): value is OverridableOutcomeStatus {
  return typeof value === "string" && OVERRIDABLE_OUTCOME_STATUSES.some((status) => status === value);
}

export function parseJsonRecord(value: string | null | undefined): Record<string, unknown> {
  const parsed = parseJson(value);
  return isRecord(parsed) ? parsed : {};
}

export function parseOrchestratorSignals(value: string | null | undefined): SignalSnapshot | null {
  const parsed = parseJson(value);
  return isSignalSnapshot(parsed) ? parsed : null;
}

export function parseOrchestratorPriorities(value: string | null | undefined): AgentPriority[] | null {
  const parsed = parseJson(value);
  return Array.isArray(parsed) && parsed.every(isAgentPriority) ? parsed : null;
}

export function parseOrchestratorActions(value: string | null | undefined): OrchestratorPlan["actions"] | null {
  const parsed = parseJson(value);
  return Array.isArray(parsed) && parsed.every(isOrchestratorAction) ? parsed : null;
}

export function parseWorkflowSteps(value: string | null | undefined): WorkflowStep[] | null {
  const parsed = parseJson(value);
  return Array.isArray(parsed) && parsed.every(isWorkflowStep) ? parsed : null;
}

function parseJson(value: string | null | undefined): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAgentPriority(value: unknown): value is AgentPriority {
  return isRecord(value)
    && isAgentKey(value.agent)
    && isFiniteNumber(value.score)
    && value.score >= 0
    && value.score <= 100
    && typeof value.reason === "string"
    && typeof value.recommendedAction === "string";
}

function isOrchestratorAction(value: unknown): value is OrchestratorPlan["actions"][number] {
  return isRecord(value)
    && isAgentKey(value.agent)
    && typeof value.action === "string"
    && (value.status === "executed" || value.status === "queued" || value.status === "skipped");
}

function isWorkflowStep(value: unknown): value is WorkflowStep {
  return isRecord(value)
    && typeof value.agent === "string"
    && typeof value.label === "string"
    && typeof value.output === "string"
    && (value.status === "completed" || value.status === "failed" || value.status === "skipped")
    && isFiniteNumber(value.durationMs)
    && value.durationMs >= 0;
}

function isSignalSnapshot(value: unknown): value is SignalSnapshot {
  if (!isRecord(value)) return false;
  const revenue = recordField(value, "revenue");
  const leads = recordField(value, "leads");
  const inbox = recordField(value, "inbox");
  const comments = recordField(value, "comments");
  const approvals = recordField(value, "approvals");
  const posts = recordField(value, "posts");
  const competitor = recordField(value, "competitor");
  const forecast = recordField(value, "forecast");

  return revenue !== null
    && finiteFields(revenue, ["last7", "prev7", "deltaPct"])
    && leads !== null
    && finiteFields(leads, ["hotUnclosed", "coldNoNurture", "newToday"])
    && inbox !== null
    && finiteFields(inbox, ["unread"])
    && comments !== null
    && finiteFields(comments, ["negativeUnreplied"])
    && approvals !== null
    && finiteFields(approvals, ["pendingOver24h"])
    && posts !== null
    && finiteFields(posts, ["scheduledTomorrow", "engagement7dAvg", "engagement14dPriorAvg"])
    && competitor !== null
    && finiteFields(competitor, ["surgeCount"])
    && (competitor.topPostId === null || typeof competitor.topPostId === "string")
    && forecast !== null
    && finiteFields(forecast, ["next7Predicted", "vsAverage"])
    && isFiniteNumber(value.pendingDecisionFails);
}

const AGENT_KEYS = [
  "ads_creative",
  "proactive_sales",
  "content_research",
  "intelligence",
  "promotion",
  "inbox_rules",
  "approval_review",
] as const satisfies readonly AgentKey[];

function isAgentKey(value: unknown): value is AgentKey {
  return typeof value === "string" && AGENT_KEYS.some((key) => key === value);
}

function recordField(record: Record<string, unknown>, key: string): Record<string, unknown> | null {
  return isRecord(record[key]) ? record[key] : null;
}

function finiteFields(record: Record<string, unknown>, keys: string[]): boolean {
  return keys.every((key) => isFiniteNumber(record[key]));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
