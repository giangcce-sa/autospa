import { randomUUID } from "crypto";
import { generateImages, type ImageFormat } from "@/lib/openai";
import { applyOverlay } from "@/lib/image-overlay";
import { prisma } from "@/lib/db";
import { buildImagePrompt, scoreImagePrompt } from "@/lib/image-prompt-engine";
import { getVisualProfile, parseVisualProfile } from "@/lib/visual-profile";
import { getCompetitorContext } from "@/lib/learning/competitor-learning";
import { buildStaffReferences } from "@/lib/image-reference";
import { analyzeGeneratedImage, type ImageVisionResult } from "@/lib/image-vision";
import { persistImageSource } from "@/lib/media-storage";
import { accessErrorResponse, requirePageAccess } from "@/lib/page-access";
import { NextRequest, NextResponse } from "next/server";
import { finishJobRun, startJobRun } from "@/lib/activity-log";

const LIMITED_PRESETS = new Set(["organic", "story", "testimonial", "educational"]);

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(Math.max(Math.round(parsed), min), max) : fallback;
}

export async function POST(req: NextRequest) {
  const requestStarted = Date.now();
  let jobId: string | null = null;
  try {
    const body = await req.json();
    const {
      serviceId, style, customPrompt, postId, character, equipment: equipmentKey,
      referenceDesc, format, preset, visualBrief, caption,
      overlayCaption, overlaySubheadline, overlayCta, overlayBadge, overlayLogo, overlayPosition, overlayTemplate,
      facebookPageId, staffProfileId,
    } = body;

    const post = postId
      ? await prisma.post.findUnique({ where: { id: postId }, include: { service: true } })
      : null;
    const resolvedPageId = facebookPageId ?? post?.facebookPageId ?? null;
    await requirePageAccess(resolvedPageId, { owner: true });
    jobId = (await startJobRun("image_generation", "manual", `Generate image variants for ${resolvedPageId ?? "global"}`).catch(() => null))?.id ?? null;

    if (post && post.facebookPageId !== resolvedPageId) {
      return NextResponse.json({ success: false, error: "Bài viết không thuộc Facebook Page đang chọn" }, { status: 403 });
    }

    const service = serviceId
      ? await prisma.service.findFirst({ where: { id: serviceId, facebookPageId: resolvedPageId } })
      : post?.service ?? null;
    if (serviceId && !service) {
      return NextResponse.json({ success: false, error: "Dịch vụ không thuộc Facebook Page đang chọn" }, { status: 404 });
    }

    const [brand, visualProfile, competitorCtx, staffVisual, settings] = await Promise.all([
      prisma.brandKit.findFirst({ where: { facebookPageId: resolvedPageId } }),
      getVisualProfile(resolvedPageId),
      getCompetitorContext().catch(() => ({ insight: "" })),
      staffProfileId
        ? prisma.staffVisualProfile.findFirst({
            where: {
              id: staffProfileId,
              facebookPageId: resolvedPageId,
              isActive: true,
              consentStatus: { not: "blocked" },
            },
            include: { samples: { orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }], take: 4 } },
          })
        : null,
      prisma.settings.findFirst({ select: { imageModel: true } }),
    ]);
    if (staffProfileId && !staffVisual) {
      return NextResponse.json({ success: false, error: "Nhân viên mẫu không hợp lệ hoặc không thuộc Page này" }, { status: 403 });
    }
    if (staffVisual?.consentStatus === "limited" && !LIMITED_PRESETS.has(preset ?? "organic")) {
      return NextResponse.json({ success: false, error: "Nhân viên này chỉ được dùng cho nội dung organic/giới hạn" }, { status: 403 });
    }

    const parsedProfile = parseVisualProfile(visualProfile);
    const staffContext = staffVisual ? {
      name: staffVisual.name,
      role: staffVisual.role,
      gender: staffVisual.gender,
      promptDescriptor: staffVisual.promptDescriptor,
      appearanceNotes: staffVisual.appearanceNotes,
      uniformNotes: staffVisual.uniformNotes,
      usageNotes: staffVisual.usageNotes,
      referenceImageUrl: staffVisual.referenceImageUrl ?? staffVisual.samples[0]?.imageUrl ?? null,
      sampleCount: staffVisual.samples.length,
    } : null;
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
      visualProfile: parsedProfile,
      staffVisual: staffContext,
      competitorInsight: "insight" in competitorCtx ? competitorCtx.insight : "",
    });
    const promptQuality = scoreImagePrompt(promptResult, {
      caption: caption ?? post?.caption,
      visualBrief: customPrompt || visualBrief,
      serviceName: service?.name,
      brand,
      format,
      preset,
      visualProfile: parsedProfile,
      staffVisual: staffContext,
    });

    const referenceRecords = staffVisual ? await buildStaffReferences(staffVisual, 3) : [];
    const references = referenceRecords.map((item) => ({ imageBase64: item.imageBase64, weight: item.weight }));
    const referenceMode = references.length
      ? body.referenceMode === "appearance" || body.referenceMode === "style" ? body.referenceMode : "identity"
      : "none";
    const referenceStrength = Math.min(Math.max(Number(body.referenceStrength) || 0.82, 0), 1);
    const variantCount = clampInt(body.variantCount, 1, 4, 1);
    const maxAutoRetries = body.autoQualityCheck === false ? 0 : clampInt(body.maxAutoRetries, 0, 2, 1);

    let rawImages = await generateImages(promptResult.finalPrompt, (promptResult.format as ImageFormat) ?? "feed", {
      count: variantCount,
      references,
      referenceMode: referenceMode === "none" ? undefined : referenceMode,
      referenceStrength,
    });
    while (rawImages.length < variantCount) {
      const more = await generateImages(promptResult.finalPrompt, (promptResult.format as ImageFormat) ?? "feed", {
        count: 1,
        references,
        referenceMode: referenceMode === "none" ? undefined : referenceMode,
        referenceStrength,
      });
      rawImages = [...rawImages, ...more];
    }

    const batchId = randomUUID();
    const resolvedTemplate = overlayTemplate ?? (preset === "flash_deal" ? "promo" : "minimal");
    const resolvedOverlayCaption = overlayCaption ?? promptResult.suggestedOverlay.headline;
    const variants = [];

    for (const [index, initialImage] of rawImages.slice(0, variantCount).entries()) {
      let rawImageUrl = initialImage;
      let vision: ImageVisionResult | null = null;
      let visionError: string | null = null;
      let retryCount = 0;

      while (true) {
        if (body.autoQualityCheck !== false) {
          try {
            vision = await analyzeGeneratedImage({
              imageUrl: rawImageUrl,
              prompt: promptResult.finalPrompt,
              serviceName: service?.name,
              brandName: brand?.spaName,
              format: promptResult.format,
              staffDescriptor: staffVisual?.promptDescriptor,
              referenceBase64: referenceRecords.map((item) => item.imageBase64),
            });
          } catch (error) {
            visionError = error instanceof Error ? error.message : String(error);
          }
        }
        if (!vision || vision.score >= 60 || retryCount >= maxAutoRetries) break;
        retryCount += 1;
        const replacement = await generateImages(`${promptResult.finalPrompt}\n\nQuality correction: ${vision.issues.map((issue) => issue.message).join("; ")}`, (promptResult.format as ImageFormat) ?? "feed", {
          count: 1,
          references,
          referenceMode: referenceMode === "none" ? undefined : referenceMode,
          referenceStrength,
        });
        rawImageUrl = replacement[0] ?? rawImageUrl;
      }

      let composedImageUrl = rawImageUrl;
      if (resolvedTemplate !== "none" && (resolvedOverlayCaption || overlayLogo)) {
        composedImageUrl = await applyOverlay(rawImageUrl, {
          caption: resolvedOverlayCaption,
          subheadline: overlaySubheadline ?? promptResult.suggestedOverlay.subheadline,
          cta: overlayCta ?? promptResult.suggestedOverlay.cta,
          badge: overlayBadge ?? promptResult.suggestedOverlay.badge,
          template: resolvedTemplate,
          showLogo: overlayLogo !== false,
          position: overlayPosition ?? "top-right",
          brand,
        });
      }

      const stored = await persistImageSource(composedImageUrl, `generated/${resolvedPageId ?? "global"}`).catch(() => null);
      const imageUrl = stored?.url ?? composedImageUrl;
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
          batchId,
          variantIndex: index,
          referenceMode,
          referenceSampleIds: JSON.stringify(referenceRecords.map((item) => item.sampleId)),
          prompt: promptResult.prompt,
          negativePrompt: promptResult.negativePrompt,
          finalPrompt: promptResult.finalPrompt,
          imageUrl,
          originalImageUrl: rawImageUrl.startsWith("data:") ? null : rawImageUrl,
          storageKey: stored?.key ?? null,
          overlayTemplate: resolvedTemplate,
          qualityScore: vision?.score ?? promptQuality.score,
          promptScore: promptQuality.score,
          visionScore: vision?.score ?? null,
          visionDetails: vision ? JSON.stringify(vision) : visionError ? JSON.stringify({ error: visionError }) : null,
          generationStatus: vision && vision.score < 80 ? "review" : "completed",
          retryCount,
          latencyMs: Date.now() - requestStarted,
          estimatedCostUsd: Number((0.03 * (1 + retryCount)).toFixed(4)),
          scoreDetails: JSON.stringify({ prompt: promptQuality, vision, visionError }),
        },
      });
      variants.push({
        imageUrl,
        generationId: generation.id,
        vision,
        retryCount,
        status: generation.generationStatus,
      });
    }

    const first = variants[0];
    if (!first) throw new Error("Không tạo được biến thể ảnh");
    if (postId) {
      await prisma.post.update({ where: { id: postId }, data: { imageUrl: first.imageUrl, imagePrompt: promptResult.finalPrompt } });
    }

    if (jobId) {
      await finishJobRun(jobId, {
        status: "completed",
        summary: `Generated ${variants.length} image variant(s)`,
        metrics: {
          batchId,
          variants: variants.length,
          references: references.length,
          retries: variants.reduce((sum, item) => sum + item.retryCount, 0),
          latencyMs: Date.now() - requestStarted,
        },
      }).catch(() => null);
    }

    return NextResponse.json({
      data: {
        imageUrl: first.imageUrl,
        prompt: promptResult.finalPrompt,
        generationId: first.generationId,
        quality: promptQuality,
        vision: first.vision,
        variants,
        batchId,
        referenceApplied: references.length > 0,
        referenceMode,
        suggestedOverlay: promptResult.suggestedOverlay,
      },
      success: true,
    });
  } catch (error) {
    if (jobId) {
      await finishJobRun(jobId, {
        status: "failed",
        summary: "Image generation failed",
        error: error instanceof Error ? error.message : String(error),
      }).catch(() => null);
    }
    const accessResponse = accessErrorResponse(error);
    if (accessResponse) return accessResponse;
    const message = error instanceof Error ? error.message : "Lỗi không xác định";
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}
