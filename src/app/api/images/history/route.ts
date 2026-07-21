import { prisma } from "@/lib/db";
import { accessErrorResponse, requirePageAccess } from "@/lib/page-access";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const params = new URL(req.url).searchParams;
    const facebookPageId = params.get("facebookPageId") || null;
    await requirePageAccess(facebookPageId);
    const take = Math.min(Math.max(Number(params.get("take")) || 24, 1), 60);
    const generations = await prisma.imageGeneration.findMany({
      where: {
        facebookPageId,
        ...(params.get("staffProfileId") ? { staffProfileId: params.get("staffProfileId") } : {}),
      },
      select: {
        id: true,
        parentGenerationId: true,
        batchId: true,
        variantIndex: true,
        imageUrl: true,
        format: true,
        preset: true,
        promptScore: true,
        visionScore: true,
        generationStatus: true,
        userAccepted: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take,
    });
    return NextResponse.json({ success: true, data: generations });
  } catch (error) {
    const accessResponse = accessErrorResponse(error);
    if (accessResponse) return accessResponse;
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
