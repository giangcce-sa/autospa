import { prisma } from "@/lib/db";
import { generateContent } from "@/lib/claude";
import { AccessError, requirePageAccess } from "@/lib/page-access";
import { routeErrorResponse } from "@/lib/api-response";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const facebookPageId = new URL(req.url).searchParams.get("facebookPageId");
    if (!facebookPageId) throw new AccessError("Hãy chọn Facebook Page", 400);
    await requirePageAccess(facebookPageId);
    const posts = await prisma.post.findMany({
      where: { postType: "promotion", facebookPageId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { service: { select: { name: true } } },
    });
    return NextResponse.json({ data: posts, success: true });
  } catch (error) {
    return routeErrorResponse(error, "Lỗi khi tải");
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, facebookPageId } = body;
    if (!facebookPageId) throw new AccessError("Hãy chọn Facebook Page", 400);
    await requirePageAccess(facebookPageId, { owner: true });

    if (action !== "generate") {
      return NextResponse.json({ error: "Khuyến mãi phải handoff sang Publishing để review, schedule hoặc publish", success: false }, { status: 400 });
    }

    const { dealName, discount, validUntil, serviceId, description } = body;
    if (!dealName || !Number.isFinite(Number(discount)) || Number(discount) <= 0 || Number(discount) > 100) {
      return NextResponse.json({ error: "Tên chương trình hoặc mức giảm không hợp lệ", success: false }, { status: 400 });
    }

    const [brand, service, styleProfile] = await Promise.all([
      prisma.brandKit.findUnique({ where: { facebookPageId } }),
      serviceId ? prisma.service.findFirst({ where: { id: serviceId, facebookPageId } }) : null,
      prisma.styleProfile.findUnique({ where: { facebookPageId } }),
    ]);
    if (serviceId && !service) throw new AccessError("Dịch vụ không thuộc Facebook Page đã chọn", 403);

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
      : "Bạn là copywriter chuyên nghiệp. Viết caption bài đăng + hashtag. Trả về 2 phần: CAPTION: và HASHTAGS:";
    const raw = await generateContent(prompt, systemPrompt);
    const captionMatch = raw.match(/CAPTION:\s*([\s\S]*?)(?=HASHTAGS:|$)/i);
    const hashtagsMatch = raw.match(/HASHTAGS:\s*([\s\S]*?)$/i);
    const caption = captionMatch ? captionMatch[1].trim() : raw;
    const hashtags = hashtagsMatch ? hashtagsMatch[1].trim() : "";
    const post = await prisma.post.create({
      data: {
        caption,
        hashtags,
        platform: "facebook",
        postType: "promotion",
        status: "draft",
        facebookPageId,
        serviceId: service?.id ?? null,
      },
    });

    return NextResponse.json({ data: { postId: post.id, caption, hashtags }, success: true });
  } catch (error) {
    return routeErrorResponse(error, "Lỗi không xác định");
  }
}
