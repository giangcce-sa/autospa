// Pure Brain skill policy — no prisma, no server-only. Importable from node tests.
import {
  type BrainDomain,
  type PermissionLevel,
  type RiskLevel,
  normalizeCategory,
  normalizeDomain,
} from "./brain-taxonomy.ts";

export interface BrainSkillDraft {
  name: string;
  description?: string;
  domain: BrainDomain;
  category: string;
  tags: string[];
  inputSignals: string[];
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  playbook: string;
  tools: string[];
  successMetric?: string;
  permissionLevel: PermissionLevel;
  riskLevel: RiskLevel;
  confidence: number;
  classificationConfidence: number;
  councilNotes?: string;
}

export const DEFAULT_TRIGGER = { type: "manual", description: "User hoặc Orchestrator gọi khi phù hợp." };

export function clamp01(value: unknown, fallback: number) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

export function normalizeRisk(value: unknown): RiskLevel {
  return value === "high" || value === "medium" || value === "low" ? value : "medium";
}

export function normalizePermission(value: unknown, risk: RiskLevel): PermissionLevel {
  if (value === "auto" && risk !== "low") return "supervised";
  if (value === "auto" || value === "supervised" || value === "draft" || value === "suggest") return value;
  return risk === "high" ? "supervised" : "draft";
}

export function asStringArray(value: unknown, fallback: string[] = []) {
  if (!Array.isArray(value)) return fallback;
  return value.map((item) => String(item).trim()).filter(Boolean).slice(0, 12);
}

export function inferDraft(instruction: string): BrainSkillDraft {
  const text = instruction.toLowerCase();
  let domain: BrainDomain = "operation";
  if (/(lead|sale|chốt|đặt lịch|booking|khách lạnh|khách nóng)/i.test(text)) domain = "sales";
  else if (/(bài|caption|content|ảnh|hình|khuyến mãi|story|hashtag)/i.test(text)) domain = "content";
  else if (/(ads|quảng cáo|campaign|ngân sách|ctr|scale|pause)/i.test(text)) domain = "ads";
  else if (/(đối thủ|trend|thị trường|viral|listening)/i.test(text)) domain = "intelligence";
  else if (/(inbox|comment|bình luận|khiếu nại|chăm sóc)/i.test(text)) domain = "customer";
  else if (/(brand|thương hiệu|giọng văn|faq|chính sách|dịch vụ)/i.test(text)) domain = "brand";

  const risk: RiskLevel = /(tự gửi|auto gửi|ngân sách|quảng cáo|khiếu nại|tiêu cực|xóa|pause|scale)/i.test(text)
    ? "high"
    : /(gửi|duyệt|khách|lead|comment|inbox)/i.test(text)
      ? "medium"
      : "low";

  const category = normalizeCategory(domain, undefined);
  const permissionLevel = normalizePermission(undefined, risk);

  return {
    name: instruction.slice(0, 58).replace(/[.。]+$/, "") || "Skill mới",
    description: instruction,
    domain,
    category,
    tags: instruction.split(/\s+/).filter((w) => w.length > 4).slice(0, 6),
    inputSignals: [],
    triggerType: /(sau|ngày|giờ|tuần)/i.test(text) ? "time_based" : "manual",
    triggerConfig: DEFAULT_TRIGGER,
    playbook: instruction,
    tools: domain === "sales" ? ["crm", "inbox", "zalo"] : domain === "content" ? ["content", "publish"] : [],
    successMetric: domain === "sales" ? "reply_rate, booking_rate" : domain === "content" ? "engagement_rate" : "completion_rate",
    permissionLevel,
    riskLevel: risk,
    confidence: 0.58,
    classificationConfidence: 0.58,
    councilNotes: "Fallback rule-based classification. Cần review nếu muốn dùng tự động.",
  };
}

export function normalizeDraft(raw: unknown, instruction: string): BrainSkillDraft {
  const fallback = inferDraft(instruction);
  const obj = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const domain = normalizeDomain(String(obj.domain ?? fallback.domain));
  const risk = normalizeRisk(obj.riskLevel ?? fallback.riskLevel);
  const permissionLevel = normalizePermission(obj.permissionLevel ?? fallback.permissionLevel, risk);

  return {
    name: String(obj.name ?? fallback.name).slice(0, 100),
    description: obj.description ? String(obj.description).slice(0, 500) : fallback.description,
    domain,
    category: normalizeCategory(domain, String(obj.category ?? fallback.category)),
    tags: asStringArray(obj.tags, fallback.tags),
    inputSignals: asStringArray(obj.inputSignals, fallback.inputSignals),
    triggerType: String(obj.triggerType ?? fallback.triggerType).slice(0, 40),
    triggerConfig: obj.triggerConfig && typeof obj.triggerConfig === "object"
      ? obj.triggerConfig as Record<string, unknown>
      : fallback.triggerConfig,
    playbook: String(obj.playbook ?? fallback.playbook).slice(0, 4000),
    tools: asStringArray(obj.tools, fallback.tools),
    successMetric: obj.successMetric ? String(obj.successMetric).slice(0, 180) : fallback.successMetric,
    permissionLevel,
    riskLevel: risk,
    confidence: clamp01(obj.confidence, fallback.confidence),
    classificationConfidence: clamp01(obj.classificationConfidence, fallback.classificationConfidence),
    councilNotes: obj.councilNotes ? String(obj.councilNotes).slice(0, 800) : fallback.councilNotes,
  };
}

export function extractJson(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("AI không trả JSON");
  return JSON.parse(match[0]) as unknown;
}
