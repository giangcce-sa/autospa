import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

async function postToZalo(message: string, imageUrl?: string): Promise<string> {
  const settings = await prisma.settings.findFirst();
  if (!settings?.zaloToken || !settings?.zaloOaId) throw new Error("Chưa cấu hình Zalo OA");

  const endpoint = "https://openapi.zalo.me/v2.0/oa/message/cs";
  const payload = {
    recipient: { oa_id: settings.zaloOaId },
    message: imageUrl
      ? { attachment: { type: "template", payload: { template_type: "media", elements: [{ media_type: "image", url: imageUrl }] } }, text: message }
      : { text: message },
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", access_token: settings.zaloToken },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (data.error !== 0) throw new Error(data.message ?? "Lỗi Zalo API");
  return data.data?.message_id ?? "ok";
}

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
