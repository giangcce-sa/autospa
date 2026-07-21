import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { accessErrorResponse, requirePageAccess } from "@/lib/page-access";
import { approveVideoSkill } from "@/lib/video-studio/learning";
import { parseJson } from "@/lib/video-studio/types";

export async function GET(req: NextRequest) {
  try {
    const facebookPageId = new URL(req.url).searchParams.get("facebookPageId") || null;
    await requirePageAccess(facebookPageId);
    const data = await prisma.videoSkill.findMany({ where: { facebookPageId }, orderBy: { updatedAt: "desc" }, take: 120 });
    return NextResponse.json({ success: true, data: data.map((skill) => ({ ...skill, rules: parseJson(skill.rules, []), evidence: parseJson(skill.evidence, []) })) });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const input = z.object({ id: z.string(), action: z.enum(["approve", "reject"]), description: z.string().max(2000).optional(), rules: z.array(z.string()).max(20).optional() }).parse(await req.json());
    const existing = await prisma.videoSkill.findUnique({ where: { id: input.id }, select: { facebookPageId: true } });
    if (!existing) return NextResponse.json({ success: false, error: "Không tìm thấy skill" }, { status: 404 });
    const { user } = await requirePageAccess(existing.facebookPageId, { owner: true });
    if (input.description !== undefined || input.rules !== undefined) {
      await prisma.videoSkill.update({ where: { id: input.id }, data: { ...(input.description !== undefined ? { description: input.description } : {}), ...(input.rules ? { rules: JSON.stringify(input.rules) } : {}) } });
    }
    const skill = input.action === "approve" ? await approveVideoSkill(input.id, user.id) : await prisma.videoSkill.update({ where: { id: input.id }, data: { status: "rejected", approvedBy: user.id, approvedAt: new Date() } });
    return NextResponse.json({ success: true, data: skill });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: error instanceof z.ZodError ? 400 : 500 });
  }
}
