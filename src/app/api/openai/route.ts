import { generateImage } from "@/lib/openai";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { serviceId, style, customPrompt, postId } = await req.json();

    let basePrompt = customPrompt ?? "";

    if (!basePrompt && serviceId) {
      const service = await prisma.service.findUnique({ where: { id: serviceId } });
      if (service) {
        basePrompt = `Professional spa and beauty salon promotional image for "${service.name}" service.`;
      }
    }

    const stylePrompts: Record<string, string> = {
      luxury: "Elegant luxury spa aesthetic, soft golden lighting, minimalist composition, premium feel, warm tones",
      bright: "Bright fresh modern spa, clean white background, soft pastel colors, natural light, airy feel",
      natural: "Natural organic spa, green plants, wooden elements, soft diffused light, wellness atmosphere",
    };

    const fullPrompt = `${basePrompt}. ${stylePrompts[style] ?? stylePrompts.bright}. High quality marketing photo, professional photography, no text overlay.`;

    const imageUrl = await generateImage(fullPrompt);

    if (postId) {
      await prisma.post.update({ where: { id: postId }, data: { imageUrl, imagePrompt: fullPrompt } });
    }

    return NextResponse.json({ data: { imageUrl, prompt: fullPrompt }, success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi không xác định";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}
