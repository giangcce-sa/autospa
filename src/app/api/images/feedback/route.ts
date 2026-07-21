import { prisma } from "@/lib/db";
import { rebuildVisualProfile } from "@/lib/visual-profile";
import { NextRequest, NextResponse } from "next/server";
import { accessErrorResponse, requirePageAccess } from "@/lib/page-access";

const RATINGS = new Set(["approved", "right_style", "identity_match", "identity_mismatch", "bad_anatomy", "too_ai", "wrong_service", "off_brand", "bad_layout", "unsafe"]);

export async function POST(req: NextRequest) {
  try {
    const { generationId, rating, notes } = await req.json();
    if (!generationId || !RATINGS.has(rating)) {
      return NextResponse.json({ success: false, error: "Thiếu generationId hoặc rating không hợp lệ" }, { status: 400 });
    }

    const generation = await prisma.imageGeneration.findUnique({ where: { id: generationId } });
    if (!generation) {
      return NextResponse.json({ success: false, error: "Không tìm thấy ảnh đã tạo" }, { status: 404 });
    }
    await requirePageAccess(generation.facebookPageId, { owner: true });

    const accepted = rating === "approved" || rating === "right_style" || rating === "identity_match";
    await prisma.$transaction([
      prisma.imageFeedback.create({
        data: {
          generationId,
          rating,
          notes: notes?.trim() || null,
        },
      }),
      prisma.imageGeneration.update({
        where: { id: generationId },
        data: { userAccepted: accepted },
      }),
    ]);

    const feedbackCount = await prisma.imageFeedback.count({
      where: { generation: { facebookPageId: generation.facebookPageId } },
    });
    const visualProfile = feedbackCount >= 3
      ? await rebuildVisualProfile(generation.facebookPageId).catch(() => null)
      : null;

    return NextResponse.json({
      success: true,
      data: {
        accepted,
        visualProfile: visualProfile ? {
          id: visualProfile.id,
          approvedImages: visualProfile.approvedImages,
          rejectedImages: visualProfile.rejectedImages,
          confidence: visualProfile.confidence,
          autoApply: visualProfile.autoApply,
        } : null,
      },
    });
  } catch (error) {
    const accessResponse = accessErrorResponse(error);
    if (accessResponse) return accessResponse;
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
