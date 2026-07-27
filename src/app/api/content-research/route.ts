import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { generateContentPlan, getResearchDrafts } from "@/lib/content-research";
import { requireExplicitPageAccess } from "@/lib/page-access";
import { routeErrorResponse } from "@/lib/api-response";

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("generate"),
    facebookPageId: z.string().min(1),
    daysAhead: z.coerce.number().int().min(1).max(30).default(7),
    postsPerDay: z.coerce.number().int().min(1).max(3).default(1),
  }),
  z.object({
    action: z.literal("schedule"),
    facebookPageId: z.string().min(1),
    postId: z.string().min(1),
    scheduledAt: z.string().datetime(),
  }),
  z.object({
    action: z.literal("discard"),
    facebookPageId: z.string().min(1),
    postId: z.string().min(1),
  }),
]);

export async function GET(req: NextRequest) {
  try {
    const facebookPageId = req.nextUrl.searchParams.get("facebookPageId");
    const { page } = await requireExplicitPageAccess(facebookPageId);
    const drafts = await getResearchDrafts(page!.id, 30);
    return NextResponse.json({ success: true, data: drafts });
  } catch (error) {
    return routeErrorResponse(error, "Lỗi khi tải");
  }
}

export async function POST(req: NextRequest) {
  try {
    const input = actionSchema.parse(await req.json());
    const { page } = await requireExplicitPageAccess(input.facebookPageId, { owner: true });

    if (input.action === "generate") {
      const result = await generateContentPlan(page!.id, input.daysAhead, input.postsPerDay);
      return NextResponse.json({ success: true, data: result });
    }

    const post = await prisma.post.findUnique({
      where: { id: input.postId },
      select: { facebookPageId: true },
    });
    if (!post) return NextResponse.json({ error: "Không tìm thấy ý tưởng", success: false }, { status: 404 });
    if (post.facebookPageId !== page!.id) {
      return NextResponse.json({ error: "Ý tưởng không thuộc Facebook Page đang chọn", success: false }, { status: 403 });
    }

    if (input.action === "schedule") {
      await prisma.$transaction([
        prisma.post.update({
          where: { id: input.postId },
          data: { status: "scheduled", scheduledAt: new Date(input.scheduledAt) },
        }),
        prisma.contentGeneration.updateMany({
          where: { postId: input.postId, facebookPageId: page!.id },
          data: { userAccepted: true },
        }),
      ]);
      return NextResponse.json({ success: true });
    }

    await prisma.post.delete({ where: { id: input.postId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error, "Lỗi không xác định");
  }
}
