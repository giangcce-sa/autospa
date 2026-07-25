import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getBrainMap, parseSkillForClient, teachBrainSkill, updateSkillConfidence } from "@/lib/brain";
import { BRAIN_TAXONOMY, normalizeCategory, normalizeDomain, safeJsonParse } from "@/lib/brain-taxonomy";
import { accessErrorResponse, requireUser } from "@/lib/page-access";

export const dynamic = "force-dynamic";

function jsonString(value: unknown, fallback: unknown) {
  return JSON.stringify(value ?? fallback);
}

async function getSummary() {
  const [skills, recentRuns, recentOutcomes] = await Promise.all([
    prisma.brainSkill.findMany({
      orderBy: [{ updatedAt: "desc" }],
      take: 200,
      include: {
        runs: { orderBy: { startedAt: "desc" }, take: 1 },
        outcomes: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    prisma.brainSkillRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 30,
      include: { skill: { select: { name: true, domain: true } } },
    }),
    prisma.brainSkillOutcome.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { skill: { select: { name: true, domain: true } } },
    }),
  ]);

  const parsedSkills = skills.map((skill) => ({
    ...parseSkillForClient(skill),
    lastRun: skill.runs[0] ?? null,
    lastOutcome: skill.outcomes[0] ?? null,
    runs: undefined,
    outcomes: undefined,
  }));

  const counts = {
    total: skills.length,
    active: skills.filter((skill) => skill.status === "active").length,
    draft: skills.filter((skill) => skill.status === "draft").length,
    highRisk: skills.filter((skill) => skill.riskLevel === "high").length,
  };

  return {
    taxonomy: BRAIN_TAXONOMY,
    counts,
    map: await getBrainMap(),
    skills: parsedSkills,
    recentRuns,
    recentOutcomes,
  };
}

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    if (action === "map") {
      return NextResponse.json({ success: true, data: await getBrainMap() });
    }

    if (action === "skill") {
      const id = searchParams.get("id");
      if (!id) return NextResponse.json({ error: "Thiếu id", success: false }, { status: 400 });
      const skill = await prisma.brainSkill.findUnique({
        where: { id },
        include: {
          versions: { orderBy: { version: "desc" } },
          runs: { orderBy: { startedAt: "desc" }, take: 30 },
          outcomes: { orderBy: { createdAt: "desc" }, take: 30 },
          feedback: { orderBy: { createdAt: "desc" }, take: 30 },
        },
      });
      if (!skill) return NextResponse.json({ error: "Skill không tồn tại", success: false }, { status: 404 });
      return NextResponse.json({ success: true, data: parseSkillForClient(skill) });
    }

    return NextResponse.json({ success: true, data: await getSummary() });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return NextResponse.json({ error: "Không thể đọc dữ liệu kỹ năng", success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireUser({ owner: true });
    const body = await req.json();
    const action = body.action ?? "teach";

    if (action === "teach") {
      const instruction = typeof body.instruction === "string" ? body.instruction.trim().slice(0, 4000) : "";
      if (!instruction) return NextResponse.json({ error: "Thiếu nội dung hướng dẫn", success: false }, { status: 400 });
      const source = typeof body.source === "string" ? body.source.trim().slice(0, 100) || "manual" : "manual";
      const skill = await teachBrainSkill(instruction, source);
      return NextResponse.json({ success: true, data: parseSkillForClient(skill) });
    }

    if (action === "outcome") {
      const skillId = typeof body.skillId === "string" ? body.skillId.trim() : "";
      const status = body.status === "success" || body.status === "fail" || body.status === "neutral"
        ? body.status
        : null;
      if (!skillId || !status) return NextResponse.json({ error: "Thiếu skillId/status", success: false }, { status: 400 });
      const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) || undefined : undefined;
      const outcome = await updateSkillConfidence(skillId, status, notes);
      return NextResponse.json({ success: true, data: outcome });
    }

    return NextResponse.json({ error: "Action không hợp lệ", success: false }, { status: 400 });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return NextResponse.json({ error: "Không thể cập nhật kỹ năng", success: false }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireUser({ owner: true });
    const body = await req.json();
    const id = String(body.id ?? "");
    if (!id) return NextResponse.json({ error: "Thiếu id", success: false }, { status: 400 });

    const current = await prisma.brainSkill.findUnique({ where: { id } });
    if (!current) return NextResponse.json({ error: "Skill không tồn tại", success: false }, { status: 404 });

    const patch: Record<string, unknown> = {};
    const feedback: Array<{ field: string; oldValue?: string; newValue?: string }> = [];

    if (typeof body.status === "string") {
      if (!["draft", "active", "paused", "deprecated"].includes(body.status)) {
        return NextResponse.json({ error: "Status không hợp lệ", success: false }, { status: 400 });
      }
      patch.status = body.status;
      feedback.push({ field: "status", oldValue: current.status, newValue: body.status });
    }
    if (typeof body.name === "string") {
      patch.name = body.name.slice(0, 100);
      feedback.push({ field: "name", oldValue: current.name, newValue: patch.name as string });
    }
    if (typeof body.domain === "string") {
      const domain = normalizeDomain(body.domain);
      patch.domain = domain;
      patch.category = normalizeCategory(domain, typeof body.category === "string" ? body.category : current.category);
      feedback.push({ field: "domain", oldValue: current.domain, newValue: domain });
    } else if (typeof body.category === "string") {
      patch.category = normalizeCategory(normalizeDomain(current.domain), body.category);
      feedback.push({ field: "category", oldValue: current.category, newValue: patch.category as string });
    }
    if (typeof body.playbook === "string") {
      patch.playbook = body.playbook.slice(0, 4000);
      feedback.push({ field: "playbook", oldValue: current.playbook.slice(0, 500), newValue: String(patch.playbook).slice(0, 500) });
    }
    if (Array.isArray(body.tags)) patch.tags = jsonString(body.tags, safeJsonParse(current.tags, []));
    if (Array.isArray(body.tools)) patch.tools = jsonString(body.tools, safeJsonParse(current.tools, []));
    if (typeof body.permissionLevel === "string") {
      if (!["suggest", "draft", "supervised", "auto"].includes(body.permissionLevel)) {
        return NextResponse.json({ error: "Permission level không hợp lệ", success: false }, { status: 400 });
      }
      patch.permissionLevel = body.permissionLevel;
    }
    if (typeof body.riskLevel === "string") {
      if (!["low", "medium", "high"].includes(body.riskLevel)) {
        return NextResponse.json({ error: "Risk level không hợp lệ", success: false }, { status: 400 });
      }
      patch.riskLevel = body.riskLevel;
    }

    const updated = await prisma.brainSkill.update({
      where: { id },
      data: {
        ...patch,
        feedback: feedback.length
          ? {
              createMany: {
                data: feedback.map((item) => ({
                  type: "edit",
                  field: item.field,
                  oldValue: item.oldValue,
                  newValue: item.newValue,
                  note: body.note ? String(body.note) : undefined,
                })),
              },
            }
          : undefined,
      },
    });

    if (typeof patch.playbook === "string") {
      const latest = await prisma.brainSkillVersion.findFirst({
        where: { skillId: id },
        orderBy: { version: "desc" },
      });
      await prisma.brainSkillVersion.create({
        data: {
          skillId: id,
          version: (latest?.version ?? 0) + 1,
          playbook: String(patch.playbook),
          triggerConfig: current.triggerConfig,
          changeNote: body.note ? String(body.note) : "Manual edit",
        },
      });
    }

    return NextResponse.json({ success: true, data: parseSkillForClient(updated) });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return NextResponse.json({ error: "Không thể chỉnh sửa kỹ năng", success: false }, { status: 500 });
  }
}
