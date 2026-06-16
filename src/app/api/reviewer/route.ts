import { prisma } from "@/lib/db";
import { reviewContent } from "@/lib/reviewer";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { postId } = body;
    if (!postId) return NextResponse.json({ error: "Thiếu postId", success: false }, { status: 400 });

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) return NextResponse.json({ error: "Không tìm thấy bài", success: false }, { status: 404 });

    const result = await reviewContent({
      id: post.id,
      caption: post.caption,
      hashtags: post.hashtags,
      platform: post.platform,
      facebookPageId: post.facebookPageId,
    });

    return NextResponse.json({ data: result, success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}
