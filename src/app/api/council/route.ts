import { councilDebate, quickCritique } from "@/lib/ai-council";
import { formatPriorContext, saveDecision } from "@/lib/ceo-memory";
import { accessErrorResponse, requireUser } from "@/lib/page-access";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    await requireUser({ owner: true });
    const body = await req.json() as { topic?: unknown; context?: unknown; mode?: unknown };
    const topic = typeof body.topic === "string" ? body.topic.trim().slice(0, 500) : "";
    const context = typeof body.context === "string" ? body.context.trim().slice(0, 4000) : "";
    const mode = body.mode === "quick" ? "quick" : body.mode === "full" || body.mode == null ? "full" : null;

    if (!topic) {
      return NextResponse.json({ error: "Câu hỏi không được trống", success: false }, { status: 400 });
    }
    if (!mode) {
      return NextResponse.json({ error: "Chế độ Council không hợp lệ", success: false }, { status: 400 });
    }

    const priorContext = await formatPriorContext(topic).catch(() => "");
    const result = mode === "quick"
      ? await quickCritique({ topic, context, priorContext })
      : await councilDebate({ topic, context, priorContext });

    await saveDecision({ topic, context, council: result, source: "council" });
    return NextResponse.json({ data: result, success: true });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return NextResponse.json({ error: "Không thể hoàn tất Council", success: false }, { status: 500 });
  }
}
