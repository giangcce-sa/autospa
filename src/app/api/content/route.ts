import { prisma } from "@/lib/db";
import { generateContent, getBrandContext, getStyleProfile, getStyleSamples } from "@/lib/claude";
import { reviewContent } from "@/lib/reviewer";
import { getContentContext } from "@/lib/learning/content-memory";
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
    const { serviceId, postType, tone, customNote, platform, saveToLibrary, facebookPageId, includeStory, storyId } = body;

    const [brandContext, styleProfile, styleSamples, service, learningCtx] = await Promise.all([
      getBrandContext(),
      getStyleProfile(facebookPageId),
      getStyleSamples(5, facebookPageId),
      serviceId ? prisma.service.findUnique({ where: { id: serviceId } }) : null,
      getContentContext(),
    ]);

    // Pick a real spa story to weave into the post
    let storyContext: string | null = null;
    if (includeStory) {
      let story = storyId
        ? await prisma.spaStory.findUnique({ where: { id: storyId } })
        : null;

      if (!story) {
        // Auto-pick: prefer stories matching the service name, else any active
        const candidates = await prisma.spaStory.findMany({
          where: {
            facebookPageId: facebookPageId || null,
            isActive: true,
            ...(service ? { service: { contains: service.name, mode: "insensitive" as const } } : {}),
          },
          take: 5,
        });

        if (candidates.length === 0 && service) {
          // Fallback: any active story
          const all = await prisma.spaStory.findMany({
            where: { facebookPageId: facebookPageId || null, isActive: true },
            take: 10,
          });
          candidates.push(...all);
        }

        if (candidates.length > 0) {
          story = candidates[Math.floor(Math.random() * candidates.length)];
        }
      }

      if (story) {
        const who = story.customerName ? `${story.customerName}` : "một khách hàng";
        const svc = story.service ? ` (dịch vụ ${story.service})` : "";
        storyContext = `Câu chuyện thực tế từ spa${svc} — ${who}:\n"${story.content}"`;
      }
    }

    const serviceInfo = service
      ? `Dịch vụ: ${service.name}\nGiá: ${service.price ?? "liên hệ"}\nMô tả: ${service.description ?? ""}\nThời gian: ${service.duration ?? ""}`
      : "Không có dịch vụ cụ thể";

    const systemPrompt = `Bạn là chuyên gia viết content marketing cho spa và thẩm mỹ viện tại Việt Nam.
${brandContext ? `\nThông tin thương hiệu:\n${brandContext}` : ""}
${styleProfile ? `\nVăn phong cần theo:\n${styleProfile}` : ""}
${styleSamples ? `\nCác bài mẫu tham khảo văn phong:\n${styleSamples}` : ""}
${learningCtx.insight ? `\nHọc từ lịch sử: ${learningCtx.insight}` : ""}
${learningCtx.topKeywords.length > 0 ? `Từ khóa resonates với khách: ${learningCtx.topKeywords.slice(0, 5).join(", ")}` : ""}

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
${storyContext ? `\n${storyContext}\n\nYêu cầu: Kết hợp câu chuyện thực tế trên một cách tự nhiên vào bài viết. Đừng copy nguyên văn — hãy diễn đạt lại để nó trở thành điểm nhấn cảm xúc của bài.` : ""}

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
    let review = null;
    if (saveToLibrary) {
      savedPost = await prisma.post.create({
        data: { caption, hashtags, platform: platform ?? "facebook", postType: postType ?? "service", tone: tone ?? "friendly", serviceId: serviceId ?? null, facebookPageId: facebookPageId ?? null },
      });
      // Auto-review every saved post
      try {
        review = await reviewContent({
          id: savedPost.id,
          caption: savedPost.caption,
          hashtags: savedPost.hashtags,
          platform: savedPost.platform,
          facebookPageId: savedPost.facebookPageId,
        });
      } catch { /* review failure should not block save */ }
    }

    return NextResponse.json({ data: { caption, hashtags, postId: savedPost?.id, review }, success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi không xác định";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}
