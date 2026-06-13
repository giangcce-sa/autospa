import { prisma } from "@/lib/db";
import { generateContent, getBrandContext, getStyleProfile, getStyleSamples } from "@/lib/claude";
import { NextRequest, NextResponse } from "next/server";

const POST_TYPE_LABELS: Record<string, string> = {
  service: "giới thiệu dịch vụ",
  promotion: "thông báo khuyến mãi",
  tip: "tip làm đẹp",
  intro: "giới thiệu combo",
};

const TONE_LABELS: Record<string, string> = {
  friendly: "thân thiện, gần gũi, như người bạn",
  professional: "chuyên nghiệp, tư vấn uy tín",
  luxury: "sang trọng, tinh tế, cao cấp",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { serviceId, postType, tone, customNote, platform, saveToLibrary } = body;

    const [brandContext, styleProfile, styleSamples, service] = await Promise.all([
      getBrandContext(),
      getStyleProfile(),
      getStyleSamples(5),
      serviceId ? prisma.service.findUnique({ where: { id: serviceId } }) : null,
    ]);

    const serviceInfo = service
      ? `Dịch vụ: ${service.name}\nGiá: ${service.price ?? "liên hệ"}\nMô tả: ${service.description ?? ""}\nThời gian: ${service.duration ?? ""}`
      : "Không có dịch vụ cụ thể";

    const systemPrompt = `Bạn là chuyên gia viết content marketing cho spa và thẩm mỹ viện tại Việt Nam.
${brandContext ? `\nThông tin thương hiệu:\n${brandContext}` : ""}
${styleProfile ? `\nVăn phong cần theo:\n${styleProfile}` : ""}
${styleSamples ? `\nCác bài mẫu tham khảo văn phong:\n${styleSamples}` : ""}

Quy tắc bắt buộc:
- Viết hoàn toàn bằng tiếng Việt
- Tone giọng: ${TONE_LABELS[tone] ?? "thân thiện"}
- Không hứa hẹn kết quả 100%, không dùng từ ngữ phóng đại
- Không vi phạm chính sách Facebook về ngành làm đẹp
- Có CTA rõ ràng nhưng không quá thúc ép
- Có yếu tố cảm xúc, dễ đọc trên điện thoại
- Trả về đúng 2 phần: CAPTION (nội dung bài đăng) và HASHTAGS (danh sách hashtag, mỗi cái một dòng)`;

    const prompt = `Viết bài ${POST_TYPE_LABELS[postType] ?? "giới thiệu"} cho ${platform ?? "Facebook"}.

${serviceInfo}
${customNote ? `Ghi chú thêm: ${customNote}` : ""}

Trả về theo format:
CAPTION:
[Nội dung bài viết]

HASHTAGS:
[hashtag1]
[hashtag2]
...`;

    const result = await generateContent(prompt, systemPrompt);

    const captionMatch = result.match(/CAPTION:\s*([\s\S]*?)(?=\nHASHTAGS:|$)/i);
    const hashtagsMatch = result.match(/HASHTAGS:\s*([\s\S]*?)$/i);
    const caption = captionMatch?.[1]?.trim() ?? result;
    const hashtags = hashtagsMatch?.[1]?.trim() ?? "";

    let savedPost = null;
    if (saveToLibrary) {
      savedPost = await prisma.post.create({
        data: { caption, hashtags, platform: platform ?? "facebook", postType: postType ?? "service", tone: tone ?? "friendly", serviceId: serviceId ?? null },
      });
    }

    return NextResponse.json({ data: { caption, hashtags, postId: savedPost?.id }, success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi không xác định";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}
