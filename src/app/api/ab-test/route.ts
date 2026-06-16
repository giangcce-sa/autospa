import { prisma } from "@/lib/db";
import { generateContent } from "@/lib/claude";
import { councilDebate } from "@/lib/ai-council";
import { reviewContent } from "@/lib/reviewer";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const abGroupId = searchParams.get("abGroupId");

    if (abGroupId) {
      const posts = await prisma.post.findMany({
        where: { abGroupId },
        include: { analytics: true },
        orderBy: { createdAt: "asc" },
      });
      return NextResponse.json({ data: posts, success: true });
    }

    // List all A/B groups (distinct abGroupId)
    const groups = await prisma.post.findMany({
      where: { abGroupId: { not: null } },
      distinct: ["abGroupId"],
      select: { abGroupId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // For each group, fetch both posts
    const result = await Promise.all(
      groups.map(async (g) => {
        const posts = await prisma.post.findMany({
          where: { abGroupId: g.abGroupId! },
          include: { analytics: true },
          orderBy: { createdAt: "asc" },
        });
        return { abGroupId: g.abGroupId, posts, createdAt: g.createdAt };
      })
    );

    return NextResponse.json({ data: result, success: true });
  } catch {
    return NextResponse.json({ error: "Lỗi khi tải", success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, facebookPageId: rawPageId } = body;
    const facebookPageId = rawPageId || null;

    if (action === "create") {
      const { caption, serviceId, platform, tone } = body as {
        caption: string;
        serviceId?: string;
        platform?: string;
        tone?: string;
      };

      // Generate variant B via Claude with a different tone/angle
      const prompt = `Đây là bài viết gốc (phiên bản A):\n\n${caption}\n\n` +
        `Hãy viết lại thành phiên bản B với ${tone === "luxury" ? "giọng thân thiện hơn" : "giọng sang trọng, đẳng cấp hơn"}, ` +
        `cùng nội dung nhưng cách diễn đạt và cấu trúc khác. ` +
        `Trả về chỉ caption (không cần hashtag).`;

      const captionB = await generateContent(prompt, "Bạn là copywriter chuyên nghiệp. Viết lại ngắn gọn, sắc sảo.");

      const abGroupId = randomBytes(6).toString("hex");

      const [postA, postB] = await Promise.all([
        prisma.post.create({
          data: {
            caption,
            abGroupId,
            status: "draft",
            platform: platform ?? "facebook",
            postType: "service",
            tone: tone ?? "friendly",
            qualityNotes: "A/B Test — Phiên bản A (gốc)",
            serviceId: serviceId ?? null,
            facebookPageId,
          },
        }),
        prisma.post.create({
          data: {
            caption: captionB,
            abGroupId,
            status: "draft",
            platform: platform ?? "facebook",
            postType: "service",
            tone: tone === "luxury" ? "friendly" : "luxury",
            qualityNotes: "A/B Test — Phiên bản B (AI biến thể)",
            serviceId: serviceId ?? null,
            facebookPageId,
          },
        }),
      ]);

      // Auto-review cả 2 variants — quan trọng để biết variant nào safe trước khi đăng
      const [reviewA, reviewB] = await Promise.all([
        reviewContent({ id: postA.id, caption: postA.caption, hashtags: postA.hashtags, platform: postA.platform, facebookPageId: postA.facebookPageId }).catch(() => null),
        reviewContent({ id: postB.id, caption: postB.caption, hashtags: postB.hashtags, platform: postB.platform, facebookPageId: postB.facebookPageId }).catch(() => null),
      ]);

      return NextResponse.json({ data: { abGroupId, postA, postB, reviewA, reviewB }, success: true });
    }

    if (action === "judge") {
      // 2 AI bàn luận về 2 variant — predict/explain winner
      const { abGroupId } = body as { abGroupId: string };
      const posts = await prisma.post.findMany({
        where: { abGroupId },
        include: { analytics: true },
        orderBy: { createdAt: "asc" },
      });
      if (posts.length < 2) {
        return NextResponse.json({ error: "Cần 2 phiên bản A/B", success: false }, { status: 400 });
      }
      const [a, b] = posts;
      const statsA = a.analytics
        ? `${a.analytics.likes} likes, ${a.analytics.comments} comments, ${a.analytics.shares} shares, ${a.analytics.reach} reach`
        : "chưa có analytics";
      const statsB = b.analytics
        ? `${b.analytics.likes} likes, ${b.analytics.comments} comments, ${b.analytics.shares} shares, ${b.analytics.reach} reach`
        : "chưa có analytics";

      const context = `PHIÊN BẢN A (tone: ${a.tone}, status: ${a.status}):
"${a.caption}"
Analytics: ${statsA}

PHIÊN BẢN B (tone: ${b.tone}, status: ${b.status}):
"${b.caption}"
Analytics: ${statsB}`;

      const council = await councilDebate({
        topic:
          a.analytics || b.analytics
            ? "Phiên bản A hay B hiệu quả hơn và TẠI SAO? Học được gì cho lần tới?"
            : "Phiên bản A hay B nhiều khả năng sẽ thắng và TẠI SAO?",
        context,
      });

      return NextResponse.json({
        data: {
          synthesis: council.synthesis,
          turns: council.turns,
          abGroupId,
        },
        success: true,
      });
    }

    if (action === "declare-winner") {
      const { winnerId, abGroupId } = body as { winnerId: string; abGroupId: string };
      await prisma.post.updateMany({
        where: { abGroupId, id: { not: winnerId } },
        data: { qualityNotes: "A/B Test — Thua" },
      });
      await prisma.post.update({
        where: { id: winnerId },
        data: { qualityNotes: "A/B Test — Thắng" },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Action không hợp lệ", success: false }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi không xác định";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}
