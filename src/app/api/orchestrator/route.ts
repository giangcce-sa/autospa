import { prisma } from "@/lib/db";
import { runOrchestrator } from "@/lib/orchestrator";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const latest = await prisma.orchestratorRun.findFirst({
      orderBy: { runAt: "desc" },
    });

    if (!latest) {
      // Run now if no history
      const plan = await runOrchestrator();
      return NextResponse.json({ data: { plan, fresh: true }, success: true });
    }

    return NextResponse.json({
      data: {
        plan: {
          signals: JSON.parse(latest.signals),
          priorities: JSON.parse(latest.priorities),
          actions: JSON.parse(latest.actions),
          mode: latest.mode,
        },
        runAt: latest.runAt,
        fresh: false,
      },
      success: true,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}

export async function POST() {
  try {
    const plan = await runOrchestrator();
    return NextResponse.json({ data: plan, success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}
