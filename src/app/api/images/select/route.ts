import { prisma } from "@/lib/db";
import { accessErrorResponse, requirePageAccess } from "@/lib/page-access";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { postId, generationId } = await req.json();
    if (!postId || !generationId) {
      return NextResponse.json({ success: false, error: "Thiếu postId hoặc generationId" }, { status: 400 });
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, facebookPageId: true },
    });
    if (!post) {
      return NextResponse.json({ success: false, error: "Không tìm thấy bài viết hoặc ảnh" }, { status: 404 });
    }
    await requirePageAccess(post.facebookPageId, { owner: true });

    const updated = await prisma.$transaction(async (tx) => {
      const generation = await tx.imageGeneration.findUnique({
        where: { id: generationId },
        select: { imageUrl: true, finalPrompt: true, facebookPageId: true, postId: true },
      });
      if (!generation) return null;
      if (post.facebookPageId !== generation.facebookPageId || (generation.postId && generation.postId !== post.id)) {
        throw new Error("IMAGE_DESTINATION_MISMATCH");
      }

      const claimed = await tx.imageGeneration.updateMany({
        where: {
          id: generationId,
          OR: [{ postId: null }, { postId: post.id }],
        },
        data: { postId: post.id },
      });
      if (claimed.count !== 1) throw new Error("IMAGE_DESTINATION_MISMATCH");

      return tx.post.update({
        where: { id: post.id },
        data: { imageUrl: generation.imageUrl, imagePrompt: generation.finalPrompt },
        select: { id: true, imageUrl: true },
      });
    });
    if (!updated) {
      return NextResponse.json({ success: false, error: "Không tìm thấy bài viết hoặc ảnh" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    if (error instanceof Error && error.message === "IMAGE_DESTINATION_MISMATCH") {
      return NextResponse.json({ success: false, error: "Ảnh không thuộc bài viết và Facebook Page này" }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
