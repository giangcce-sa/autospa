import { prisma } from "@/lib/db";
import { runOrchestrator } from "@/lib/orchestrator";
import { accessErrorResponse, requireUser } from "@/lib/page-access";
import { parseOrchestratorActions, parseOrchestratorPriorities, parseOrchestratorSignals } from "@/lib/ai-runtime-types";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await requireUser();
    const latest = await prisma.orchestratorRun.findFirst({ orderBy: { runAt: "desc" } });

    return NextResponse.json({
      data: latest ? {
        plan: {
          signals: parseOrchestratorSignals(latest.signals),
          priorities: parseOrchestratorPriorities(latest.priorities),
          actions: parseOrchestratorActions(latest.actions),
          mode: latest.mode,
        },
        runAt: latest.runAt,
        fresh: false,
      } : {
        plan: null,
        runAt: null,
        fresh: false,
      },
      success: true,
    });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return NextResponse.json({ error: "Không thể đọc trạng thái điều phối", success: false }, { status: 500 });
  }
}

export async function POST() {
  try {
    await requireUser({ owner: true });
    const plan = await runOrchestrator();
    return NextResponse.json({ data: plan, success: true });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return NextResponse.json({ error: "Không thể chạy orchestrator", success: false }, { status: 500 });
  }
}
