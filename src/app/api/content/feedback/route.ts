import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { contentChangeRatio, scoreHumanWriting } from "@/lib/content-humanizer";
import { rebuildHumanVoiceProfile } from "@/lib/human-voice";
import { accessErrorResponse, requirePageAccess } from "@/lib/page-access";

export async function POST(req: NextRequest) {
  try {
    const { generationId, caption, hashtags, acceptedVoice } = await req.json();
    if (!generationId || !caption?.trim()) {
      return NextResponse.json({ success: false, error: "Thiếu generationId hoặc caption" }, { status: 400 });
    }
    const generation = await prisma.contentGeneration.findUnique({ where: { id: generationId } });
    if (!generation) {
      return NextResponse.json({ success: false, error: "Không tìm thấy phiên bản nội dung" }, { status: 404 });
    }
    await requirePageAccess(generation.facebookPageId);

    const finalCaption = caption.trim();
    const ratio = contentChangeRatio(generation.editorCaption, finalCaption);
    const score = scoreHumanWriting(finalCaption, true);
    const changeSummary = ratio === 0
      ? "Người dùng giữ nguyên bản Human Editor"
      : `Người dùng thay đổi khoảng ${Math.round(ratio * 100)}% nội dung`;

    await prisma.$transaction([
      prisma.contentGeneration.update({
        where: { id: generationId },
        data: {
          finalCaption,
          hashtags: hashtags?.trim() || generation.hashtags,
          humanScore: score.score,
          scoreDetails: JSON.stringify(score),
          userAccepted: typeof acceptedVoice === "boolean" ? acceptedVoice : undefined,
        },
      }),
      prisma.contentEdit.upsert({
        where: { generationId },
        create: {
          generationId,
          originalContent: generation.editorCaption,
          finalContent: finalCaption,
          changeRatio: ratio,
          changeSummary,
          acceptedVoice: acceptedVoice === true,
        },
        update: {
          finalContent: finalCaption,
          changeRatio: ratio,
          changeSummary,
          acceptedVoice: typeof acceptedVoice === "boolean" ? acceptedVoice : undefined,
        },
      }),
      ...(generation.postId ? [
        prisma.post.update({
          where: { id: generation.postId },
          data: { caption: finalCaption, hashtags: hashtags?.trim() || generation.hashtags },
        }),
      ] : []),
    ]);

    let voiceProfile = null;
    if (acceptedVoice === true) {
      const existingSample = await prisma.styleSample.findFirst({
        where: { source: `human_edit:${generationId}` },
      });
      if (!existingSample) {
        await prisma.styleSample.create({
          data: {
            facebookPageId: generation.facebookPageId,
            content: finalCaption,
            source: `human_edit:${generationId}`,
          },
        });
      }
      const acceptedCount = await prisma.contentEdit.count({
        where: {
          acceptedVoice: true,
          generation: { facebookPageId: generation.facebookPageId },
        },
      });
      if (acceptedCount === 3 || acceptedCount % 3 === 0) {
        voiceProfile = await rebuildHumanVoiceProfile(generation.facebookPageId).catch(() => null);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        humanScore: score,
        changeRatio: ratio,
        voiceProfile: voiceProfile ? {
          id: voiceProfile.id,
          approvedEdits: voiceProfile.approvedEdits,
          confidence: voiceProfile.confidence,
          autoApply: voiceProfile.autoApply,
        } : null,
      },
    });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
