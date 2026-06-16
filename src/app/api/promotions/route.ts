import { prisma } from "@/lib/db";
import { generateContent } from "@/lib/claude";
import { postToFacebook } from "@/lib/facebook";
import { postToZalo } from "@/lib/zalo";
import { reviewContent } from "@/lib/reviewer";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const facebookPageId = new URL(req.url).searchParams.get("facebookPageId") || null;
    const posts = await prisma.post.findMany({
      where: { postType: "promotion", facebookPageId: facebookPageId ?? undefined },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { service: { select: { name: true } } },
    });
    return NextResponse.json({ data: posts, success: true });
  } catch {
    return NextResponse.json({ error: "Lỗi khi tải", success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, facebookPageId: rawPageId } = body;
    const facebookPageId = rawPageId || null;

    if (action === "generate") {
      const { dealName, discount, validUntil, serviceId, description } = body;

      const [brand, service, styleProfile] = await Promise.all([
        prisma.brandKit.findFirst({ where: { facebookPageId } }),
        serviceId ? prisma.service.findUnique({ where: { id: serviceId } }) : null,
        prisma.styleProfile.findFirst({ where: { facebookPageId } }),
      ]);

      const spaName = brand?.spaName ?? "Spa của chúng tôi";
      const serviceText = service ? `dịch vụ ${service.name}` : "các dịch vụ";
      const validText = validUntil ? `Ưu đãi có hiệu lực đến ${validUntil}.` : "";

      const prompt = `Viết bài đăng Facebook giới thiệu chương trình khuyến mãi cho spa:
- Spa: ${spaName}
- Chương trình: ${dealName}
- Giảm: ${discount}% cho ${serviceText}
- ${validText}
${description ? `- Chi tiết: ${description}` : ""}

Yêu cầu: hấp dẫn, tạo cảm giác cấp bách, kêu gọi hành động rõ ràng, có hashtag phù hợp.`;

      const systemPrompt = styleProfile?.profile
        ? `Bạn là copywriter chuyên nghiệp. Áp dụng văn phong sau:\n${styleProfile.profile}\nViết caption bài đăng + hashtag (tách dòng cuối). Trả về 2 phần: CAPTION: và HASHTAGS:`
        : `Bạn là copywriter chuyên nghiệp. Viết caption bài đăng + hashtag. Trả về 2 phần: CAPTION: và HASHTAGS:`;

      const raw = await generateContent(prompt, systemPrompt);
      const captionMatch = raw.match(/CAPTION:\s*([\s\S]*?)(?=HASHTAGS:|$)/i);
      const hashtagsMatch = raw.match(/HASHTAGS:\s*([\s\S]*?)$/i);
      const caption = captionMatch ? captionMatch[1].trim() : raw;
      const hashtags = hashtagsMatch ? hashtagsMatch[1].trim() : "";

      return NextResponse.json({ data: { caption, hashtags }, success: true });
    }

    if (action === "publish") {
      const { caption, hashtags, imageUrl, platform, scheduledAt, serviceId, force } = body;
      if (!caption) return NextResponse.json({ error: "Thiếu caption", success: false }, { status: 400 });

      const fullCaption = [caption, hashtags].filter(Boolean).join("\n\n");

      // Tạo Post draft trước để có id cho reviewer
      const post = await prisma.post.create({
        data: {
          caption,
          hashtags: hashtags ?? "",
          imageUrl: imageUrl ?? null,
          platform: platform ?? "facebook",
          postType: "promotion",
          status: "draft",  // tạm draft, sẽ update sau review
          facebookPageId,
          serviceId: serviceId ?? null,
        },
      });

      // Reviewer Agent gate — FB ngành làm đẹp dễ bị flag
      const review = await reviewContent({
        id: post.id,
        caption: post.caption,
        hashtags: post.hashtags,
        platform: post.platform,
        facebookPageId: post.facebookPageId,
      }).catch(() => null);

      if (review && review.status === "fail" && !force) {
        return NextResponse.json({
          error: "REVIEW_BLOCKED",
          review,
          postId: post.id,
          success: false,
        }, { status: 422 });
      }

      if (scheduledAt) {
        const updated = await prisma.post.update({
          where: { id: post.id },
          data: { status: "scheduled", scheduledAt: new Date(scheduledAt) },
        });
        return NextResponse.json({ data: updated, review, success: true });
      }

      // Publish now
      let fbPostId: string | undefined;
      if (platform === "zalo") {
        await postToZalo(fullCaption, imageUrl ?? undefined);
      } else {
        fbPostId = await postToFacebook(fullCaption, imageUrl ?? undefined, facebookPageId ?? undefined);
      }

      const updated = await prisma.post.update({
        where: { id: post.id },
        data: {
          status: "published",
          publishedAt: new Date(),
          fbPostId: fbPostId ?? null,
        },
      });
      return NextResponse.json({ data: updated, review, success: true });
    }

    return NextResponse.json({ error: "Action không hợp lệ", success: false }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi không xác định";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}
