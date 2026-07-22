import { prisma } from "@/lib/db";
import { accessErrorResponse, requirePageAccess } from "@/lib/page-access";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const params = new URL(req.url).searchParams;
    const facebookPageId = params.get("facebookPageId") || null;
    await requirePageAccess(facebookPageId);
    const take = Math.min(Math.max(Number(params.get("take")) || 24, 1), 60);
    const cursor = params.get("cursor");
    const generations = await prisma.imageGeneration.findMany({
      where: {
        facebookPageId,
        ...(params.get("staffProfileId") ? { staffProfileId: params.get("staffProfileId") } : {}),
      },
      select: {
        id: true,
        postId: true,
        parentGenerationId: true,
        batchId: true,
        variantIndex: true,
        imageUrl: true,
        model: true,
        format: true,
        preset: true,
        prompt: true,
        visualBrief: true,
        qualityScore: true,
        promptScore: true,
        visionScore: true,
        generationStatus: true,
        userAccepted: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: take + 1,
    });
    const hasMore = generations.length > take;
    const page = generations.slice(0, take).map((generation) => ({
      ...generation,
      thumbnailUrl: `/api/images/${encodeURIComponent(generation.id)}/thumbnail`,
    }));
    return NextResponse.json({
      success: true,
      data: page,
      pagination: { nextCursor: hasMore ? page.at(-1)?.id ?? null : null },
    });
  } catch (error) {
    const accessResponse = accessErrorResponse(error);
    if (accessResponse) return accessResponse;
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
