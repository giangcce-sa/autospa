import { prisma } from "./db";
import { councilDebate } from "./ai-council";
import { generateContent } from "./claude";
import {
  BRAIN_TAXONOMY,
  type BrainDomain,
  type PermissionLevel,
  type RiskLevel,
  normalizeCategory,
  normalizeDomain,
  safeJsonParse,
} from "./brain-taxonomy";

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

export interface BrainMapNode {
  domain: BrainDomain;
  label: string;
  description: string;
  color: string;
  total: number;
  active: number;
  draft: number;
  skills: Array<{
    id: string;
    name: string;
    category: string;
    confidence: number;
    riskLevel: string;
    permissionLevel: string;
    status: string;
    updatedAt: Date;
  }>;
}

const DEFAULT_TRIGGER = { type: "manual", description: "User hoặc Orchestrator gọi khi phù hợp." };

function clamp01(value: unknown, fallback: number) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

function normalizeRisk(value: unknown): RiskLevel {
  return value === "high" || value === "medium" || value === "low" ? value : "medium";
}

function normalizePermission(value: unknown, risk: RiskLevel): PermissionLevel {
  if (value === "auto" && risk !== "low") return "supervised";
  if (value === "auto" || value === "supervised" || value === "draft" || value === "suggest") return value;
  return risk === "high" ? "supervised" : "draft";
}

function asStringArray(value: unknown, fallback: string[] = []) {
  if (!Array.isArray(value)) return fallback;
  return value.map((item) => String(item).trim()).filter(Boolean).slice(0, 12);
}

function inferDraft(instruction: string): BrainSkillDraft {
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

function normalizeDraft(raw: unknown, instruction: string): BrainSkillDraft {
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

function extractJson(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("AI không trả JSON");
  return JSON.parse(match[0]) as unknown;
}

export async function teachBrainSkill(instruction: string, source = "manual") {
  const trimmed = instruction.trim();
  if (trimmed.length < 12) throw new Error("Instruction quá ngắn để tạo skill");

  const taxonomy = Object.values(BRAIN_TAXONOMY)
    .map((d) => `${d.domain}: ${d.categories.join(", ")}`)
    .join("\n");

  let draft = inferDraft(trimmed);
  let notes = draft.councilNotes ?? "";

  try {
    const raw = await generateContent(
      `Instruction user dạy bộ não AutoSpa:\n"${trimmed}"\n\nTaxonomy hợp lệ:\n${taxonomy}\n\nChuẩn hóa thành JSON duy nhất:
{
  "name": "tên skill ngắn",
  "description": "mô tả 1 câu",
  "domain": "sales|content|ads|intelligence|customer|operation|brand",
  "category": "chọn trong category của domain",
  "tags": ["..."],
  "inputSignals": ["tên tín hiệu cần đọc"],
  "triggerType": "manual|time_based|signal_based|event_based",
  "triggerConfig": { "description": "điều kiện kích hoạt cụ thể" },
  "playbook": "các bước thực hiện rõ ràng",
  "tools": ["crm|inbox|zalo|content|publish|ads|reports|settings"],
  "successMetric": "metric đo hiệu quả",
  "permissionLevel": "suggest|draft|supervised|auto",
  "riskLevel": "low|medium|high",
  "confidence": 0.0,
  "classificationConfidence": 0.0
}

Quy tắc: skill mới không được auto nếu có gửi tin, khách hàng, ads budget, hoặc khiếu nại. Chỉ trả JSON.`,
      "Bạn là AI trainer cho hệ thống AutoSpa Brain. Chỉ trả JSON hợp lệ.",
    );
    draft = normalizeDraft(extractJson(raw), trimmed);
  } catch (e) {
    notes = `AI normalize lỗi, dùng fallback rule-based: ${e instanceof Error ? e.message : String(e)}`;
  }

  try {
    const council = await councilDebate({
      topic: `Review skill mới: ${draft.name}`,
      context: `Instruction gốc: ${trimmed}
Skill draft:
${JSON.stringify(draft, null, 2)}

Kiểm tra: nhóm có đúng không, risk có đúng không, permission có an toàn không, trigger có rõ không?`,
    });
    notes = council.synthesis.slice(0, 1200);
    if (/rủi ro cao|high risk|không nên auto|cần duyệt/i.test(council.synthesis)) {
      draft.riskLevel = draft.riskLevel === "low" ? "medium" : draft.riskLevel;
      draft.permissionLevel = "supervised";
    }
  } catch (e) {
    notes = notes || `Council review lỗi: ${e instanceof Error ? e.message : String(e)}`;
  }

  const status = draft.classificationConfidence < 0.75 || draft.riskLevel === "high" ? "draft" : "draft";
  const skill = await prisma.brainSkill.create({
    data: {
      name: draft.name,
      description: draft.description,
      domain: draft.domain,
      category: draft.category,
      tags: JSON.stringify(draft.tags),
      inputSignals: JSON.stringify(draft.inputSignals),
      triggerType: draft.triggerType,
      triggerConfig: JSON.stringify(draft.triggerConfig),
      playbook: draft.playbook,
      tools: JSON.stringify(draft.tools),
      successMetric: draft.successMetric,
      permissionLevel: draft.permissionLevel,
      riskLevel: draft.riskLevel,
      confidence: draft.confidence,
      classificationConfidence: draft.classificationConfidence,
      status,
      learnedFrom: source,
      councilNotes: notes,
      versions: {
        create: {
          version: 1,
          playbook: draft.playbook,
          triggerConfig: JSON.stringify(draft.triggerConfig),
          changeNote: "Initial taught skill",
        },
      },
      feedback: {
        create: {
          type: "note",
          note: `Created from instruction: ${trimmed.slice(0, 500)}`,
        },
      },
    },
  });

  return skill;
}

export async function getBrainMap(): Promise<BrainMapNode[]> {
  const skills = await prisma.brainSkill.findMany({
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: 300,
  });

  return Object.values(BRAIN_TAXONOMY).map((meta) => {
    const domainSkills = skills.filter((skill) => skill.domain === meta.domain);
    return {
      domain: meta.domain,
      label: meta.label,
      description: meta.description,
      color: meta.color,
      total: domainSkills.length,
      active: domainSkills.filter((skill) => skill.status === "active").length,
      draft: domainSkills.filter((skill) => skill.status === "draft").length,
      skills: domainSkills.slice(0, 10).map((skill) => ({
        id: skill.id,
        name: skill.name,
        category: skill.category,
        confidence: skill.confidence,
        riskLevel: skill.riskLevel,
        permissionLevel: skill.permissionLevel,
        status: skill.status,
        updatedAt: skill.updatedAt,
      })),
    };
  });
}

export async function updateSkillConfidence(skillId: string, status: "success" | "fail" | "neutral", notes?: string) {
  const skill = await prisma.brainSkill.findUnique({ where: { id: skillId } });
  if (!skill) throw new Error("Skill không tồn tại");

  const delta = status === "success" ? 0.05 : status === "fail" ? -0.08 : 0;
  const next = Math.max(0.05, Math.min(0.98, skill.confidence + delta));
  const outcome = await prisma.brainSkillOutcome.create({
    data: {
      skillId,
      metric: skill.successMetric ?? "manual_feedback",
      status,
      notes,
      confidenceDelta: delta,
    },
  });
  await prisma.brainSkill.update({ where: { id: skillId }, data: { confidence: next } });
  return outcome;
}

export function parseSkillForClient<T extends { tags: string; inputSignals: string; tools: string; triggerConfig: string }>(skill: T) {
  return {
    ...skill,
    tags: safeJsonParse<string[]>(skill.tags, []),
    inputSignals: safeJsonParse<string[]>(skill.inputSignals, []),
    tools: safeJsonParse<string[]>(skill.tools, []),
    triggerConfig: safeJsonParse<Record<string, unknown>>(skill.triggerConfig, {}),
  };
}
