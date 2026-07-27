import { prisma } from "./db";
import { councilDebate } from "./ai-council";
import { generateContent } from "./claude";
import {
  BRAIN_TAXONOMY,
  type BrainDomain,
  safeJsonParse,
} from "./brain-taxonomy";
import { extractJson, inferDraft, normalizeDraft } from "./brain-policy";

export type { BrainSkillDraft } from "./brain-policy";

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
