import { generateContent } from "@/lib/claude";
import { prisma } from "@/lib/db";
import { accessErrorResponse, requireExplicitPageAccess } from "@/lib/page-access";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const qualitySchema = z.object({
  caption: z.string().trim().min(1).max(5000),
  hashtags: z.string().max(1000).optional(),
  postId: z.string().min(1).optional(),
  facebookPageId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const { caption, hashtags, postId, facebookPageId } = qualitySchema.parse(await req.json());
    const { page } = await requireExplicitPageAccess(facebookPageId, { owner: true });
    if (postId) {
      const post = await prisma.post.findUnique({
        where: { id: postId },
        select: { facebookPageId: true },
      });
      if (!post) return NextResponse.json({ error: "Không tìm thấy bài viết", success: false }, { status: 404 });
      if (post.facebookPageId !== page!.id) {
        return NextResponse.json({ error: "Bài viết không thuộc Facebook Page đang chọn", success: false }, { status: 403 });
      }
    }

    const systemPrompt = `Bạn là chuyên gia kiểm soát chất lượng content marketing cho spa và thẩm mỹ viện. Đánh giá khách quan và cho điểm theo các tiêu chí.`;

    const prompt = `Kiểm tra và đánh giá bài viết Facebook sau cho spa:

CAPTION:
${caption}

HASHTAGS:
${hashtags ?? ""}

Trả về theo đúng format JSON sau (không thêm gì ngoài JSON):
{
  "score": <số từ 0-100>,
  "checks": [
    {"label": "Chính tả", "pass": true/false, "note": "..."},
    {"label": "Có CTA", "pass": true/false, "note": "..."},
    {"label": "Yếu tố cảm xúc", "pass": true/false, "note": "..."},
    {"label": "Dễ đọc mobile", "pass": true/false, "note": "..."},
    {"label": "Không vi phạm chính sách Facebook", "pass": true/false, "note": "..."},
    {"label": "Không hứa hẹn quá mức", "pass": true/false, "note": "..."}
  ],
  "suggestions": ["Gợi ý 1", "Gợi ý 2"],
  "summary": "Tóm tắt ngắn"
}`;

    const result = await generateContent(prompt, systemPrompt);

    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Không parse được kết quả");
    const parsed = JSON.parse(jsonMatch[0]);

    if (postId) {
      await prisma.post.update({ where: { id: postId }, data: { qualityScore: parsed.score, qualityNotes: parsed.summary } });
    }

    return NextResponse.json({ data: parsed, success: true });
  } catch (err) {
    const access = accessErrorResponse(err);
    if (access) return access;
    const msg = err instanceof Error ? err.message : "Lỗi không xác định";
    return NextResponse.json({ error: msg, success: false }, { status: err instanceof z.ZodError ? 400 : 500 });
  }
}
