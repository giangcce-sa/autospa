import { prisma } from "@/lib/db";
import { triggerWorkflow, type WorkflowName } from "@/lib/workflows";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (id) {
      const run = await prisma.workflowRun.findUnique({ where: { id } });
      if (!run) return NextResponse.json({ error: "Not found", success: false }, { status: 404 });
      return NextResponse.json({
        data: {
          ...run,
          steps: JSON.parse(run.steps),
        },
        success: true,
      });
    }

    const runs = await prisma.workflowRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 20,
      select: { id: true, name: true, trigger: true, status: true, startedAt: true, completedAt: true, plan: true },
    });
    return NextResponse.json({ data: runs, success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, trigger } = body as { name: WorkflowName; trigger?: string };
    if (!name) return NextResponse.json({ error: "Thiếu name", success: false }, { status: 400 });

    const result = await triggerWorkflow(name, trigger ?? `Manual trigger: ${name}`);
    return NextResponse.json({ data: result, success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}
