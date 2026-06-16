import { councilDebate, quickCritique } from "@/lib/ai-council";
import { formatPriorContext, saveDecision } from "@/lib/ceo-memory";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { topic, context, mode } = await req.json() as {
      topic: string;
      context?: string;
      mode?: "full" | "quick";
    };

    if (!topic?.trim()) {
      return NextResponse.json({ error: "Câu hỏi không được trống", success: false }, { status: 400 });
    }

    const t = topic.trim();
    const ctx = context ?? "";
    const priorContext = await formatPriorContext(t).catch(() => "");

    const result = mode === "quick"
      ? await quickCritique({ topic: t, context: ctx, priorContext })
      : await councilDebate({ topic: t, context: ctx, priorContext });

    // Save decision (no outcome tracking — user-initiated)
    await saveDecision({ topic: t, context: ctx, council: result, source: "council" }).catch(() => null);

    return NextResponse.json({ data: result, success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}
