import { randomUUID } from "crypto";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import { applyOverlay } from "@/lib/image-overlay";
import { imageSourceToBuffer, persistImageSource } from "@/lib/media-storage";
import { accessErrorResponse, requirePageAccess } from "@/lib/page-access";
import { NextRequest, NextResponse } from "next/server";

const SIZES: Record<string, { width: number; height: number }> = {
  feed: { width: 1024, height: 1024 },
  cover: { width: 1792, height: 1024 },
  story: { width: 1024, height: 1792 },
  thumbnail: { width: 1792, height: 1024 },
  zalo: { width: 1024, height: 1024 },
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const facebookPageId = typeof body.facebookPageId === "string" && body.facebookPageId ? body.facebookPageId : null;
    await requirePageAccess(facebookPageId, { owner: true });
    const source = await prisma.imageGeneration.findFirst({
      where: { id: body.generationId, facebookPageId },
    });
    if (!source) return NextResponse.json({ success: false, error: "Không tìm thấy ảnh trong Page này" }, { status: 404 });

    const format = SIZES[body.format] ? body.format : source.format;
    const size = SIZES[format] ?? SIZES.feed;
    const input = await imageSourceToBuffer(source.imageUrl, source.storageKey);
    const cropped = await sharp(input)
      .rotate()
      .resize({ width: size.width, height: size.height, fit: "cover", position: body.cropPosition ?? "attention" })
      .png()
      .toBuffer();
    let edited = `data:image/png;base64,${cropped.toString("base64")}`;

    const brand = await prisma.brandKit.findFirst({ where: { facebookPageId } });
    if (body.overlay?.enabled !== false) {
      edited = await applyOverlay(edited, {
        caption: body.overlay?.caption,
        subheadline: body.overlay?.subheadline,
        cta: body.overlay?.cta,
        badge: body.overlay?.badge,
        template: body.overlay?.template ?? "minimal",
        showLogo: body.overlay?.showLogo !== false,
        position: body.overlay?.position ?? "top-right",
        brand,
      });
    }
    const stored = await persistImageSource(edited, `generated/${facebookPageId ?? "global"}`);
    const version = await prisma.imageGeneration.create({
      data: {
        postId: source.postId,
        facebookPageId: source.facebookPageId,
        serviceId: source.serviceId,
        promptVersion: source.promptVersion,
        model: source.model,
        preset: source.preset,
        format,
        sourceCaption: source.sourceCaption,
        visualBrief: source.visualBrief,
        staffProfileId: source.staffProfileId,
        parentGenerationId: source.id,
        batchId: randomUUID(),
        variantIndex: 0,
        referenceMode: source.referenceMode,
        referenceSampleIds: source.referenceSampleIds,
        prompt: source.prompt,
        negativePrompt: source.negativePrompt,
        finalPrompt: source.finalPrompt,
        imageUrl: stored.url,
        storageKey: stored.key,
        overlayTemplate: body.overlay?.enabled === false ? "none" : body.overlay?.template ?? "minimal",
        qualityScore: source.qualityScore,
        promptScore: source.promptScore,
        visionScore: source.visionScore,
        visionDetails: source.visionDetails,
        generationStatus: "completed",
        retryCount: source.retryCount,
        scoreDetails: source.scoreDetails,
      },
    });

    if (source.postId && body.applyToPost === true) {
      await prisma.post.update({ where: { id: source.postId }, data: { imageUrl: version.imageUrl } });
    }
    return NextResponse.json({
      success: true,
      data: {
        imageUrl: version.imageUrl,
        generationId: version.id,
        parentGenerationId: source.id,
        format: version.format,
      },
    });
  } catch (error) {
    const accessResponse = accessErrorResponse(error);
    if (accessResponse) return accessResponse;
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
