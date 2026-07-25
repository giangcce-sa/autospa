import { isWorkflowName, parseWorkflowSteps } from "@/lib/ai-runtime-types";
import { prisma } from "@/lib/db";
import { accessErrorResponse, requireUser } from "@/lib/page-access";
import { triggerWorkflow } from "@/lib/workflows";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    await requireUser();
    const id = new URL(req.url).searchParams.get("id");

    if (id) {
      const run = await prisma.workflowRun.findUnique({ where: { id } });
      if (!run) return NextResponse.json({ error: "Không tìm thấy workflow", success: false }, { status: 404 });
      return NextResponse.json({ data: { ...run, steps: parseWorkflowSteps(run.steps) }, success: true });
    }

    const runs = await prisma.workflowRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 20,
      select: { id: true, name: true, trigger: true, status: true, startedAt: true, completedAt: true, plan: true },
    });
    return NextResponse.json({ data: runs, success: true });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return NextResponse.json({ error: "Không thể đọc workflow", success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireUser({ owner: true });
    const body = await req.json() as { name?: unknown; trigger?: unknown };
    const name = isWorkflowName(body.name) ? body.name : null;
    if (!name) return NextResponse.json({ error: "Workflow không hợp lệ", success: false }, { status: 400 });

    const trigger = typeof body.trigger === "string"
      ? body.trigger.trim().slice(0, 500)
      : `Manual trigger: ${name}`;
    const result = await triggerWorkflow(name, trigger || `Manual trigger: ${name}`);
    return NextResponse.json(
      { data: result, success: result.status === "completed" },
      { status: result.status === "completed" ? 200 : 502 },
    );
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return NextResponse.json({ error: "Không thể chạy workflow", success: false }, { status: 500 });
  }
}
