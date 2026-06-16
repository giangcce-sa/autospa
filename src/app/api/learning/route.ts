import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runAllLearningLoops } from "@/lib/learning";
import { getBehaviorInsights } from "@/lib/learning/customer-behavior";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    if (action === "insights") {
      const insights = await prisma.learningInsight.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      return NextResponse.json({ success: true, data: insights });
    }

    if (action === "content-memory") {
      const mem = await prisma.contentMemory.findFirst({ where: { platform: "facebook" } });
      return NextResponse.json({ success: true, data: mem });
    }

    if (action === "source-weights") {
      const weights = await prisma.leadSourceWeight.findMany({ orderBy: { weight: "desc" } });
      return NextResponse.json({ success: true, data: weights });
    }

    if (action === "behavior") {
      const data = await getBehaviorInsights();
      return NextResponse.json({ success: true, data });
    }

    if (action === "decisions") {
      const decisions = await prisma.cEODecision.findMany({
        where: { outcomeStatus: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true, topic: true, outcomeStatus: true, outcomeMetric: true,
          outcomeBefore: true, outcomeAfter: true, outcomeNotes: true, createdAt: true,
        },
      });
      return NextResponse.json({ success: true, data: decisions });
    }

    // Default: summary
    const [contentMem, sourceWeights, recentInsights, behavior] = await Promise.all([
      prisma.contentMemory.findFirst({ where: { platform: "facebook" } }),
      prisma.leadSourceWeight.findMany({ orderBy: { weight: "desc" }, take: 5 }),
      prisma.learningInsight.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
      getBehaviorInsights(),
    ]);

    return NextResponse.json({
      success: true,
      data: { contentMem, sourceWeights, recentInsights, behavior },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e), success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { action } = await req.json();

    if (action === "run") {
      const result = await runAllLearningLoops();
      return NextResponse.json({ success: true, data: result });
    }

    return NextResponse.json({ error: "Action không hợp lệ", success: false }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e), success: false }, { status: 500 });
  }
}
