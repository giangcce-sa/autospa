import { prisma } from "@/lib/db";
import { generateContent } from "@/lib/claude";
import { AccessError, requireExplicitPageAccess } from "@/lib/page-access";
import { routeErrorResponse } from "@/lib/api-response";
import { decryptSecret } from "@/lib/secrets-crypto";
import { NextRequest, NextResponse } from "next/server";

async function fetchFbPosts(pageId: string, token: string, limit = 20) {
  const fields = "message,created_time,likes.summary(true),comments.summary(true),shares";
  const url = `https://graph.facebook.com/v21.0/${pageId}/posts?fields=${fields}&limit=${limit}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
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

export async function GET(req: NextRequest) {
  try {
    const facebookPageId = new URL(req.url).searchParams.get("facebookPageId");
    await requireExplicitPageAccess(facebookPageId);
    const [samples, profile] = await Promise.all([
      prisma.styleSample.findMany({
        where: { facebookPageId },
        orderBy: { createdAt: "desc" },
      }),
      prisma.styleProfile.findFirst({
        where: { facebookPageId },
      }),
    ]);
    return NextResponse.json({ data: { samples, profile }, success: true });
  } catch (error) {
    return routeErrorResponse(error, "Lỗi khi tải dữ liệu");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, content, likes, comments, shares, platform, facebookPageId: rawFbPageId } = body;
    const { page: authorizedPage } = await requireExplicitPageAccess(rawFbPageId, { owner: true });
    const facebookPageId = authorizedPage!.id;

    if (action === "fetch-fb") {
      const { pageId, source } = body;

      let resolvedPageId: string | undefined = pageId;
      const fbPage = await prisma.facebookPage.findUnique({ where: { id: facebookPageId } });
      if (!fbPage) return NextResponse.json({ error: "Chưa cấu hình Facebook Page trong Cài đặt", success: false }, { status: 400 });
      const token = decryptSecret(fbPage.accessToken);
      if (source === "own") {
        resolvedPageId = fbPage.fbPageId;
      }

      if (!resolvedPageId) return NextResponse.json({ error: "Chưa có Page ID", success: false }, { status: 400 });
      if (!token) return NextResponse.json({ error: "Chưa cấu hình Facebook Access Token trong Cài đặt", success: false }, { status: 400 });

      try {
        const posts = await fetchFbPosts(resolvedPageId, token, body.limit ?? 20);
        const filtered = posts.filter((p) => p.message && p.message.length > 30);
        return NextResponse.json({ data: { posts: filtered, count: filtered.length }, success: true });
      } catch (e) {
        console.error("fetchFbPosts failed:", e);
        const msg = String(e);
        const isPermission = msg.includes("pages_read_engagement") || msg.includes("#10") || msg.includes("permission");
        const isInvalidToken = msg.toLowerCase().includes("invalid") && msg.toLowerCase().includes("token");
        return NextResponse.json({
          error: isPermission ? "TOKEN_PERMISSION" : isInvalidToken ? "TOKEN_INVALID" : "Không thể tải bài viết từ Facebook",
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
            data: {
              content: p.message,
              likes: p.likes,
              comments: p.comments,
              shares: p.shares,
              source: "facebook",
              facebookPageId,
            },
          })
        )
      );
      return NextResponse.json({ data: { count: created.length }, success: true });
    }

    if (action === "add-sample") {
      const sample = await prisma.styleSample.create({
        data: {
          content,
          likes: likes ?? 0,
          comments: comments ?? 0,
          shares: shares ?? 0,
          platform: platform ?? "facebook",
          facebookPageId,
        },
      });
      return NextResponse.json({ data: sample, success: true });
    }

    if (action === "set-learning-status") {
      if (!body.id || !["approved", "rejected"].includes(body.learningStatus)) {
        return NextResponse.json({ error: "Trạng thái học không hợp lệ", success: false }, { status: 400 });
      }
      const existing = await prisma.styleSample.findFirst({ where: { id: body.id, facebookPageId } });
      if (!existing) throw new AccessError("Không tìm thấy bài mẫu trong Facebook Page này", 404);
      const sample = await prisma.styleSample.update({
        where: { id: existing.id },
        data: { learningStatus: body.learningStatus },
      });
      return NextResponse.json({ data: sample, success: true });
    }

    if (action === "analyze") {
      const samples = await prisma.styleSample.findMany({
        where: { facebookPageId, learningStatus: "approved" },
        take: 20,
      });
      if (!samples.length) return NextResponse.json({ error: "Chưa có bài mẫu nào", success: false }, { status: 400 });

      const sampleText = samples.map((s: { content: string }, i: number) => `Bài ${i + 1}:\n${s.content}`).join("\n\n---\n\n");
      const prompt = `Phân tích văn phong từ các bài viết mẫu sau và tạo một hồ sơ văn phong chi tiết:\n\n${sampleText}`;
      const systemPrompt = `Bạn là chuyên gia phân tích văn phong. Hãy phân tích kỹ và trả về hồ sơ văn phong gồm: cách xưng hô, tone giọng, cách dùng emoji, độ dài câu, cách mở đầu/kết thúc, cách gọi khách hàng, phong cách hashtag, và các đặc điểm nổi bật khác. Viết bằng tiếng Việt, súc tích và có thể dùng làm hướng dẫn viết bài sau này.`;

      const profile = await generateContent(prompt, systemPrompt);
      const existing = await prisma.styleProfile.findFirst({ where: { facebookPageId } });
      if (existing) {
        await prisma.styleProfile.update({ where: { id: existing.id }, data: { profile } });
      } else {
        await prisma.styleProfile.create({ data: { facebookPageId, profile } });
      }
      return NextResponse.json({ data: { profile }, success: true });
    }

    return NextResponse.json({ error: "Action không hợp lệ", success: false }, { status: 400 });
  } catch (err) {
    return routeErrorResponse(err, "Lỗi không xác định");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id, facebookPageId } = await req.json();
    const { page } = await requireExplicitPageAccess(facebookPageId, { owner: true });
    const sample = await prisma.styleSample.findFirst({ where: { id, facebookPageId: page!.id } });
    if (!sample) throw new AccessError("Không tìm thấy bài mẫu trong Facebook Page này", 404);
    await prisma.styleSample.delete({ where: { id: sample.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error, "Lỗi khi xóa");
  }
}
