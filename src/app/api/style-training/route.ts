import { prisma } from "@/lib/db";
import { generateContent } from "@/lib/claude";
import { NextRequest, NextResponse } from "next/server";

async function fetchFbPosts(pageId: string, token: string, limit = 20) {
  const fields = "message,created_time,likes.summary(true),comments.summary(true),shares";
  const url = `https://graph.facebook.com/v21.0/${pageId}/posts?fields=${fields}&limit=${limit}&access_token=${token}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return (data.data ?? []) as Array<{
    id: string;
    message?: string;
    created_time: string;
    likes?: { summary: { total_count: number } };
    comments?: { summary: { total_count: number } };
    shares?: { count: number };
  }>;
}

export async function GET() {
  try {
    const [samples, profile] = await Promise.all([
      prisma.styleSample.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.styleProfile.findFirst(),
    ]);
    return NextResponse.json({ data: { samples, profile }, success: true });
  } catch {
    return NextResponse.json({ error: "Lỗi khi tải dữ liệu", success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, content, likes, comments, shares, platform } = body;

    if (action === "fetch-fb") {
      const { pageId, source, facebookPageId } = body;

      // Resolve credentials: use specific page if provided, else first active page
      let resolvedPageId: string | undefined = pageId;
      let token: string | undefined;
      if (source === "own" || facebookPageId) {
        const fbPage = facebookPageId
          ? await prisma.facebookPage.findUnique({ where: { id: facebookPageId } })
          : await prisma.facebookPage.findFirst({ where: { isActive: true } });
        if (!fbPage) return NextResponse.json({ error: "Chưa cấu hình Facebook Page trong Cài đặt", success: false }, { status: 400 });
        resolvedPageId = fbPage.fbPageId;
        token = fbPage.accessToken;
      }

      if (!resolvedPageId) return NextResponse.json({ error: "Chưa có Page ID", success: false }, { status: 400 });
      if (!token) return NextResponse.json({ error: "Chưa cấu hình Facebook Access Token trong Cài đặt", success: false }, { status: 400 });

      try {
        const posts = await fetchFbPosts(resolvedPageId, token, body.limit ?? 20);
        const filtered = posts.filter((p) => p.message && p.message.length > 30);
        return NextResponse.json({ data: { posts: filtered, count: filtered.length }, success: true });
      } catch (e) {
        const msg = String(e);
        const isPermission = msg.includes("pages_read_engagement") || msg.includes("#10") || msg.includes("permission");
        const isInvalidToken = msg.toLowerCase().includes("invalid") && msg.toLowerCase().includes("token");
        return NextResponse.json({
          error: isPermission
            ? "TOKEN_PERMISSION"
            : isInvalidToken
            ? "TOKEN_INVALID"
            : msg,
          success: false,
        }, { status: 400 });
      }
    }

    if (action === "import-fb") {
      const { posts } = body as {
        posts: Array<{ message: string; likes: number; comments: number; shares: number }>;
      };
      if (!posts?.length) return NextResponse.json({ error: "Không có bài nào", success: false }, { status: 400 });

      const created = await Promise.all(
        posts.map((p) =>
          prisma.styleSample.create({
            data: { content: p.message, likes: p.likes, comments: p.comments, shares: p.shares, source: "facebook" },
          })
        )
      );
      return NextResponse.json({ data: { count: created.length }, success: true });
    }

    if (action === "add-sample") {
      const sample = await prisma.styleSample.create({
        data: { content, likes: likes ?? 0, comments: comments ?? 0, shares: shares ?? 0, platform: platform ?? "facebook" },
      });
      return NextResponse.json({ data: sample, success: true });
    }

    if (action === "analyze") {
      const samples = await prisma.styleSample.findMany({ take: 20 });
      if (!samples.length) return NextResponse.json({ error: "Chưa có bài mẫu nào", success: false }, { status: 400 });

      const sampleText = samples.map((s: { content: string }, i: number) => `Bài ${i + 1}:\n${s.content}`).join("\n\n---\n\n");
      const prompt = `Phân tích văn phong từ các bài viết mẫu sau và tạo một hồ sơ văn phong chi tiết:\n\n${sampleText}`;
      const systemPrompt = `Bạn là chuyên gia phân tích văn phong. Hãy phân tích kỹ và trả về hồ sơ văn phong gồm: cách xưng hô, tone giọng, cách dùng emoji, độ dài câu, cách mở đầu/kết thúc, cách gọi khách hàng, phong cách hashtag, và các đặc điểm nổi bật khác. Viết bằng tiếng Việt, súc tích và có thể dùng làm hướng dẫn viết bài sau này.`;

      const profile = await generateContent(prompt, systemPrompt);
      await prisma.styleProfile.upsert({ where: { id: "1" }, create: { id: "1", profile }, update: { profile } });
      return NextResponse.json({ data: { profile }, success: true });
    }

    return NextResponse.json({ error: "Action không hợp lệ", success: false }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi không xác định";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    await prisma.styleSample.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Lỗi khi xóa", success: false }, { status: 500 });
  }
}
