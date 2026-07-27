import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { contentChangeRatio, scoreHumanWriting } from "@/lib/content-humanizer";
import { rebuildHumanVoiceProfile } from "@/lib/human-voice";
import { requirePageAccess } from "@/lib/page-access";
import { routeErrorResponse } from "@/lib/api-response";
import { briefWriteData } from "@/lib/post-brief-input";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { generationId, caption, hashtags, acceptedVoice, persistPost } = body;
    if (!generationId || !caption?.trim()) {
      return NextResponse.json({ success: false, error: "Thiếu generationId hoặc caption" }, { status: 400 });
    }
    // Validated up front so an invalid brief fails with 400 before anything is written.
    const briefFields = briefWriteData(body, ["title", "summary", "outline", "hooks"]);
    const generation = await prisma.contentGeneration.findUnique({ where: { id: generationId } });
    if (!generation) {
      return NextResponse.json({ success: false, error: "Không tìm thấy phiên bản nội dung" }, { status: 404 });
    }
    await requirePageAccess(generation.facebookPageId, { owner: true });

    const finalCaption = caption.trim();
    const ratio = contentChangeRatio(generation.editorCaption, finalCaption);
    const score = scoreHumanWriting(finalCaption, true);
    const changeSummary = ratio === 0
      ? "Người dùng giữ nguyên bản Human Editor"
      : `Người dùng thay đổi khoảng ${Math.round(ratio * 100)}% nội dung`;

    const finalHashtags = hashtags?.trim() || generation.hashtags;
    const postId = await prisma.$transaction(async (tx) => {
      const current = await tx.contentGeneration.findUnique({ where: { id: generationId } });
      if (!current) throw new Error("Không tìm thấy phiên bản nội dung");

      let linkedPostId = current.postId;
      if (!linkedPostId && persistPost === true) {
        const brief = JSON.parse(current.brief) as {
          platform?: string;
          postType?: string;
          tone?: string;
          serviceId?: string;
        };
        const created = await tx.post.create({
          data: {
            caption: finalCaption,
            hashtags: finalHashtags,
            platform: brief.platform ?? "facebook",
            postType: brief.postType ?? "service",
            tone: brief.tone ?? "friendly",
            serviceId: brief.serviceId || null,
            facebookPageId: current.facebookPageId,
            ...briefFields,
          },
        });
        const linked = await tx.contentGeneration.updateMany({
          where: { id: generationId, postId: null },
          data: { postId: created.id },
        });
        if (linked.count === 1) {
          linkedPostId = created.id;
        } else {
          await tx.post.delete({ where: { id: created.id } });
          linkedPostId = (await tx.contentGeneration.findUniqueOrThrow({
            where: { id: generationId },
            select: { postId: true },
          })).postId;
        }
      }
      await Promise.all([
        tx.contentGeneration.update({
          where: { id: generationId },
          data: {
            finalCaption,
            hashtags: finalHashtags,
            humanScore: score.score,
            scoreDetails: JSON.stringify(score),
            userAccepted: typeof acceptedVoice === "boolean" ? acceptedVoice : undefined,
          },
        }),
        tx.contentEdit.upsert({
          where: { generationId },
          create: {
            generationId,
            originalContent: current.editorCaption,
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
        linkedPostId
          ? tx.post.update({
              where: { id: linkedPostId },
              data: { caption: finalCaption, hashtags: finalHashtags },
            })
          : Promise.resolve(null),
      ]);

      return linkedPostId;
    });

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
        postId,
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
    return routeErrorResponse(error, "Lỗi không xác định");
  }
}
