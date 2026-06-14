import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { postToZalo } from "@/lib/zalo";

export async function POST(req: NextRequest) {
  try {
    const { caption, hashtags, imageUrl, postId, action } = await req.json();

    if (action === "test-connection") {
      const settings = await prisma.settings.findFirst();
      if (!settings?.zaloToken) return NextResponse.json({ error: "Chưa có Zalo Token", success: false }, { status: 400 });
      return NextResponse.json({ data: { connected: true }, success: true });
    }

    const text = [caption, hashtags].filter(Boolean).join("\n\n");
    const msgId = await postToZalo(text, imageUrl);

    if (postId) {
      await prisma.post.update({ where: { id: postId }, data: { platform: "zalo", status: "published", publishedAt: new Date() } });
    }

    return NextResponse.json({ data: { messageId: msgId }, success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi không xác định";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}
