import { generateImage, type ImageFormat } from "@/lib/openai";
import { applyOverlay } from "@/lib/image-overlay";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

const CHARACTER_PROMPTS: Record<string, string> = {
  "female-vn": "featuring a Vietnamese woman with clear glowing skin as the customer, relaxed and happy expression",
  "male-vn": "featuring a Vietnamese man as the customer, clean well-groomed appearance",
  "staff-female": "featuring a professional female spa therapist in uniform, skilled and attentive",
  "hands": "close-up of skilled therapist hands performing the treatment, detailed and precise",
};

const EQUIPMENT_PROMPTS: Record<string, string> = {
  laser: "with a professional laser hair removal machine, medical-grade equipment",
  "spa-bed": "with a luxurious spa treatment bed, premium white linens",
  "facial-machine": "with advanced facial care equipment, modern skincare technology",
  "nail-tools": "with professional nail care tools, elegant manicure setup",
  "massage-tools": "with hot stones and aromatic massage oils, wellness accessories",
  "skincare-products": "with premium skincare products and serums elegantly arranged",
};

export async function POST(req: NextRequest) {
  try {
    const {
      serviceId, style, customPrompt, postId, character, equipment: equipmentKey,
      referenceDesc, format,
      overlayCaption, overlayLogo, overlayPosition,
    } = await req.json();

    let basePrompt = customPrompt ?? "";

    if (!basePrompt && serviceId) {
      const service = await prisma.service.findUnique({ where: { id: serviceId } });
      if (service) {
        basePrompt = `Professional spa and beauty salon promotional image for "${service.name}" service`;
      }
    }
    if (!basePrompt) basePrompt = "Professional spa and beauty salon promotional image";

    const stylePrompts: Record<string, string> = {
      luxury: "Elegant luxury spa aesthetic, soft golden lighting, minimalist composition, premium feel, warm tones",
      bright: "Bright fresh modern spa, clean white background, soft pastel colors, natural light, airy feel",
      natural: "Natural organic spa, green plants, wooden elements, soft diffused light, wellness atmosphere",
    };

    const parts: string[] = [basePrompt];
    if (CHARACTER_PROMPTS[character]) parts.push(CHARACTER_PROMPTS[character]);
    if (EQUIPMENT_PROMPTS[equipmentKey]) parts.push(EQUIPMENT_PROMPTS[equipmentKey]);
    if (referenceDesc?.trim()) parts.push(`visual style inspired by: ${referenceDesc.trim()}`);
    parts.push(stylePrompts[style] ?? stylePrompts.bright);
    parts.push("High quality marketing photo, professional photography, no text overlay, suitable for Vietnamese spa social media");

    const fullPrompt = parts.join(". ");

    const rawImageUrl = await generateImage(fullPrompt, (format as ImageFormat) ?? "feed");

    // Apply optional overlay (caption + logo)
    let imageUrl = rawImageUrl;
    if (overlayCaption || overlayLogo) {
      imageUrl = await applyOverlay(rawImageUrl, {
        caption: overlayCaption,
        showLogo: overlayLogo !== false,
        position: overlayPosition ?? "top-right",
      });
    }

    if (postId) {
      await prisma.post.update({ where: { id: postId }, data: { imageUrl, imagePrompt: fullPrompt } });
    }

    return NextResponse.json({ data: { imageUrl, prompt: fullPrompt }, success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi không xác định";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}
