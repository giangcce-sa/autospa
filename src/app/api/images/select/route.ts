import { prisma } from "@/lib/db";
import { accessErrorResponse, requirePageAccess } from "@/lib/page-access";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { postId, generationId } = await req.json();
    if (!postId || !generationId) {
      return NextResponse.json({ success: false, error: "Thiếu postId hoặc generationId" }, { status: 400 });
    }

    const [post, generation] = await Promise.all([
      prisma.post.findUnique({ where: { id: postId }, select: { id: true, facebookPageId: true } }),
      prisma.imageGeneration.findUnique({
        where: { id: generationId },
        select: { imageUrl: true, finalPrompt: true, facebookPageId: true, postId: true },
      }),
    ]);
    if (!post || !generation) {
      return NextResponse.json({ success: false, error: "Không tìm thấy bài viết hoặc ảnh" }, { status: 404 });
    }
    await requirePageAccess(post.facebookPageId);
    if (post.facebookPageId !== generation.facebookPageId || (generation.postId && generation.postId !== post.id)) {
      return NextResponse.json({ success: false, error: "Ảnh không thuộc bài viết và Facebook Page này" }, { status: 403 });
    }

    const updated = await prisma.post.update({
      where: { id: post.id },
      data: { imageUrl: generation.imageUrl, imagePrompt: generation.finalPrompt },
      select: { id: true, imageUrl: true },
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
