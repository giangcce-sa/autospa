import { prisma } from "@/lib/db";
import { accessErrorResponse, requireUser } from "@/lib/page-access";
import { testZaloSettings } from "@/lib/settings/channels";
import { postToZalo } from "@/lib/zalo";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    await requireUser({ owner: true });
    const { caption, hashtags, imageUrl, postId, action, apiKey } = await req.json();

    if (action === "test-connection") {
      const result = await testZaloSettings({ zaloToken: apiKey });
      return NextResponse.json(result, { status: result.success ? 200 : 502 });
    }

    const text = [caption, hashtags].filter(Boolean).join("\n\n");
    const msgId = await postToZalo(text, imageUrl);

    if (postId) {
      await prisma.post.update({ where: { id: postId }, data: { platform: "zalo", status: "published", publishedAt: new Date() } });
    }

    return NextResponse.json({ data: { messageId: msgId }, success: true });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    const message = error instanceof Error ? error.message : "Lỗi không xác định";
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}
