import { prisma } from "@/lib/db";
import { generateContent, getBrandContext, getStyleProfile } from "@/lib/claude";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    const plans = await prisma.bulkPlan.findMany({
      include: { posts: { select: { id: true, status: true, scheduledAt: true, caption: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ data: plans, success: true });
  } catch {
    return NextResponse.json({ error: "Lỗi khi tải", success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { month, year, postsPerWeek, postTypes, tone } = await req.json();
    if (!month || !year) return NextResponse.json({ error: "Thiếu tháng/năm", success: false }, { status: 400 });

    const [brandContext, styleProfile, services] = await Promise.all([
      getBrandContext(),
      getStyleProfile(),
      prisma.service.findMany({ where: { active: true }, take: 10 }),
    ]);

    const daysInMonth = new Date(year, month, 0).getDate();
    const totalPosts = Math.round((daysInMonth / 7) * (postsPerWeek ?? 3));
    const serviceList = services.map((s: { name: string; price: string | null }) => `- ${s.name} (${s.price ?? "liên hệ"})`).join("\n");
    const typeList = (postTypes ?? ["service", "tip", "promotion"]).join(", ");

    const systemPrompt = `Bạn là chuyên gia lập kế hoạch nội dung cho spa.
${brandContext ? `Thông tin spa:\n${brandContext}` : ""}
${styleProfile ? `Văn phong:\n${styleProfile}` : ""}
Viết bằng tiếng Việt.`;

    const prompt = `Tạo kế hoạch ${totalPosts} bài đăng Facebook cho tháng ${month}/${year}.

Dịch vụ spa:
${serviceList || "Chăm sóc da, triệt lông, massage, giảm béo"}

Loại bài: ${typeList}
Tone: ${tone ?? "friendly"}

Trả về JSON array theo format:
[
  {
    "day": 1,
    "postType": "service",
    "caption": "Nội dung bài viết...",
    "hashtags": "#spa #lamdep"
  }
]
Chỉ trả về JSON, không thêm gì khác.`;

    const result = await generateContent(prompt, systemPrompt);
    const jsonMatch = result.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("Không tạo được kế hoạch");

    const postsData = JSON.parse(jsonMatch[0]);

    const plan = await prisma.bulkPlan.create({
      data: {
        name: `Kế hoạch tháng ${month}/${year}`,
        month: Number(month),
        year: Number(year),
        posts: {
          create: postsData.map((p: { day: number; caption: string; hashtags: string; postType: string }) => ({
            caption: p.caption,
            hashtags: p.hashtags,
            postType: p.postType ?? "service",
            tone: tone ?? "friendly",
            platform: "facebook",
            status: "draft",
            scheduledAt: new Date(year, month - 1, p.day, 9, 0),
          })),
        },
      },
      include: { posts: true },
    });

    return NextResponse.json({ data: plan, success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi không xác định";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    await prisma.post.deleteMany({ where: { bulkPlanId: id } });
    await prisma.bulkPlan.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Lỗi khi xóa", success: false }, { status: 500 });
  }
}
