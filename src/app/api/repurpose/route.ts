import { generateContent } from "@/lib/claude";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { caption, hashtags, platform: sourcePlatform, facebookPageId } = await req.json();
    if (!caption) return NextResponse.json({ error: "Thiếu caption gốc", success: false }, { status: 400 });

    void facebookPageId; // available for future style-profile lookup

    const prompt = `Bạn có bài gốc dưới đây. Hãy tạo 4 phiên bản cho 4 nền tảng khác nhau, mỗi phiên bản phù hợp với đặc thù của nền tảng đó:

BÀI GỐC (${sourcePlatform ?? "facebook"}):
${caption}
${hashtags ? `\nHASHTAGS: ${hashtags}` : ""}

Trả về chính xác theo định dạng JSON sau (không thêm text ngoài JSON):
{
  "facebook": "<caption dài, cảm xúc, hashtag đầy đủ>",
  "zalo": "<caption ngắn hơn, thân thiện, không hashtag>",
  "story": "<caption cực ngắn 1-2 câu, dùng emoji nhiều, dành cho Story/Reels>",
  "tiktok": "<script TikTok 15-30 giây: mở đầu hook, nội dung, kêu gọi hành động>"
}`;

    const raw = await generateContent(prompt, "Bạn là chuyên gia social media đa nền tảng cho spa/beauty. Luôn trả về JSON hợp lệ.");

    // Extract JSON from response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("AI không trả về định dạng đúng");
    const variants = JSON.parse(jsonMatch[0]) as Record<string, string>;

    return NextResponse.json({ data: variants, success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi không xác định";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}
