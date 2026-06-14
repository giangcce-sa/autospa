import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateContentPlan, getResearchDrafts } from "@/lib/content-research";

export async function GET() {
  try {
    const drafts = await getResearchDrafts(30);
    return NextResponse.json({ success: true, data: drafts });
  } catch (e) {
    return NextResponse.json({ error: String(e), success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, daysAhead = 7, postsPerDay = 1, postId, scheduledAt } = body;

    if (action === "generate") {
      const result = await generateContentPlan(Number(daysAhead), Number(postsPerDay));
      return NextResponse.json({ success: true, data: result });
    }

    if (action === "schedule" && postId && scheduledAt) {
      await prisma.post.update({
        where: { id: postId },
        data: { status: "scheduled", scheduledAt: new Date(scheduledAt) },
      });
      return NextResponse.json({ success: true });
    }

    if (action === "discard" && postId) {
      await prisma.post.delete({ where: { id: postId } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Action không hợp lệ", success: false }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e), success: false }, { status: 500 });
  }
}
