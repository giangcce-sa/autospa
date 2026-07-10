import { generateImage, type ImageFormat } from "@/lib/openai";
import { applyOverlay } from "@/lib/image-overlay";
import { prisma } from "@/lib/db";
import { buildImagePrompt, scoreImagePrompt } from "@/lib/image-prompt-engine";
import { getVisualProfile, parseVisualProfile } from "@/lib/visual-profile";
import { getCompetitorContext } from "@/lib/learning/competitor-learning";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const {
      serviceId, style, customPrompt, postId, character, equipment: equipmentKey,
      referenceDesc, format, preset, visualBrief, caption,
      overlayCaption, overlaySubheadline, overlayCta, overlayBadge, overlayLogo, overlayPosition, overlayTemplate,
      facebookPageId, staffProfileId,
    } = await req.json();

    const post = postId
      ? await prisma.post.findUnique({
          where: { id: postId },
          include: { service: true },
        })
      : null;

    const resolvedPageId = facebookPageId ?? post?.facebookPageId ?? null;
    const service = serviceId
      ? await prisma.service.findUnique({ where: { id: serviceId } })
      : post?.service ?? null;

    const [brand, visualProfile, competitorCtx, staffVisual, settings] = await Promise.all([
      prisma.brandKit.findFirst({ where: { facebookPageId: resolvedPageId } }).then((found) => found ?? prisma.brandKit.findFirst()),
      getVisualProfile(resolvedPageId),
      getCompetitorContext().catch(() => ({ insight: "" })),
      staffProfileId
        ? prisma.staffVisualProfile.findFirst({
            where: {
              id: staffProfileId,
              isActive: true,
              consentStatus: { not: "blocked" },
            },
            include: { samples: { orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }], take: 4 } },
          })
        : null,
      prisma.settings.findFirst({ select: { imageModel: true, openaiBaseUrl: true } }),
    ]);

    const promptResult = buildImagePrompt({
      caption: caption ?? post?.caption,
      visualBrief: customPrompt || visualBrief,
      serviceName: service?.name,
      serviceDescription: service?.description,
      postType: post?.postType,
      tone: post?.tone,
      preset,
      style,
      character,
      equipment: equipmentKey,
      referenceDesc,
      format,
      brand,
      visualProfile: parseVisualProfile(visualProfile),
      staffVisual: staffVisual ? {
        name: staffVisual.name,
        role: staffVisual.role,
        gender: staffVisual.gender,
        promptDescriptor: staffVisual.promptDescriptor,
        appearanceNotes: staffVisual.appearanceNotes,
        uniformNotes: staffVisual.uniformNotes,
        usageNotes: staffVisual.usageNotes,
        referenceImageUrl: staffVisual.referenceImageUrl ?? staffVisual.samples[0]?.imageUrl ?? null,
        sampleCount: staffVisual.samples.length,
      } : null,
      competitorInsight: "insight" in competitorCtx ? competitorCtx.insight : "",
    });
    const quality = scoreImagePrompt(promptResult, {
      caption: caption ?? post?.caption,
      visualBrief: customPrompt || visualBrief,
        serviceName: service?.name,
        brand,
        format,
        preset,
        visualProfile: parseVisualProfile(visualProfile),
        staffVisual: staffVisual ? {
          name: staffVisual.name,
          role: staffVisual.role,
          gender: staffVisual.gender,
          promptDescriptor: staffVisual.promptDescriptor,
          appearanceNotes: staffVisual.appearanceNotes,
          uniformNotes: staffVisual.uniformNotes,
          usageNotes: staffVisual.usageNotes,
          referenceImageUrl: staffVisual.referenceImageUrl ?? staffVisual.samples[0]?.imageUrl ?? null,
          sampleCount: staffVisual.samples.length,
        } : null,
      });

    const rawImageUrl = await generateImage(promptResult.finalPrompt, (promptResult.format as ImageFormat) ?? "feed");

    // Apply optional overlay (caption + logo)
    let imageUrl = rawImageUrl;
    const resolvedOverlayCaption = overlayCaption ?? promptResult.suggestedOverlay.headline;
    const resolvedTemplate = overlayTemplate ?? (preset === "flash_deal" ? "promo" : "minimal");
    if (resolvedTemplate !== "none" && (resolvedOverlayCaption || overlayLogo)) {
      imageUrl = await applyOverlay(rawImageUrl, {
        caption: resolvedOverlayCaption,
        subheadline: overlaySubheadline ?? promptResult.suggestedOverlay.subheadline,
        cta: overlayCta ?? promptResult.suggestedOverlay.cta,
        badge: overlayBadge ?? promptResult.suggestedOverlay.badge,
        template: resolvedTemplate,
        showLogo: overlayLogo !== false,
        position: overlayPosition ?? "top-right",
      });
    }

    if (postId) {
      await prisma.post.update({ where: { id: postId }, data: { imageUrl, imagePrompt: promptResult.finalPrompt } });
    }

    const generation = await prisma.imageGeneration.create({
      data: {
        postId: postId ?? null,
        facebookPageId: resolvedPageId,
        serviceId: service?.id ?? serviceId ?? null,
        model: settings?.imageModel ?? null,
        preset: promptResult.preset,
        format: promptResult.format,
        sourceCaption: caption ?? post?.caption ?? null,
        visualBrief: customPrompt || visualBrief || null,
        staffProfileId: staffVisual?.id ?? null,
        prompt: promptResult.prompt,
        negativePrompt: promptResult.negativePrompt,
        finalPrompt: promptResult.finalPrompt,
        imageUrl,
        overlayTemplate: resolvedTemplate,
        qualityScore: quality.score,
        scoreDetails: JSON.stringify(quality),
      },
    });

    return NextResponse.json({
      data: {
        imageUrl,
        prompt: promptResult.finalPrompt,
        generationId: generation.id,
        quality,
        suggestedOverlay: promptResult.suggestedOverlay,
      },
      success: true,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi không xác định";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}
