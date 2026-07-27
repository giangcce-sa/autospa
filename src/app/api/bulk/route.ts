import { generateContent, getBrandContext, getStyleProfile } from "@/lib/claude";
import { prisma } from "@/lib/db";
import { AccessError, accessErrorResponse, requireExplicitPageAccess, requirePageAccess } from "@/lib/page-access";
import { routeErrorResponse } from "@/lib/api-response";
import { reviewContent } from "@/lib/reviewer";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const facebookPageId = new URL(req.url).searchParams.get("facebookPageId");
    const { page } = await requireExplicitPageAccess(facebookPageId);
    const plans = await prisma.bulkPlan.findMany({
      where: { facebookPageId: page!.id },
      include: { posts: { select: { id: true, status: true, scheduledAt: true, caption: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ data: plans, success: true });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return routeErrorResponse(error, "Lỗi khi tải");
  }
}

export async function POST(req: NextRequest) {
  try {
    const { month, year, postsPerWeek, postTypes, tone, facebookPageId } = await req.json();
    if (!month || !year) return NextResponse.json({ error: "Thiếu tháng/năm", success: false }, { status: 400 });
    const { page } = await requireExplicitPageAccess(facebookPageId, { owner: true });
    const pageId = page!.id;

    const [brandContext, styleProfile, services] = await Promise.all([
      getBrandContext(),
      getStyleProfile(pageId),
      prisma.service.findMany({ where: { facebookPageId: pageId, active: true }, take: 10 }),
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
        facebookPageId: pageId,
        posts: {
          create: postsData.map((p: { day: number; caption: string; hashtags: string; postType: string }) => ({
            caption: p.caption,
            hashtags: p.hashtags,
            postType: p.postType ?? "service",
            tone: tone ?? "friendly",
            platform: "facebook",
            status: "draft",
            scheduledAt: new Date(year, month - 1, p.day, 9, 0),
            facebookPageId: pageId,
          })),
        },
      },
      include: { posts: true },
    });

    await Promise.allSettled(
      plan.posts.map((post) =>
        reviewContent({
          id: post.id,
          caption: post.caption,
          hashtags: post.hashtags,
          platform: post.platform,
          facebookPageId: post.facebookPageId,
        })
      )
    );

    return NextResponse.json({ data: plan, success: true });
  } catch (err) {
    const access = accessErrorResponse(err);
    if (access) return access;
    return routeErrorResponse(err, "Lỗi không xác định");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (typeof id !== "string" || !id) {
      return NextResponse.json({ error: "Thiếu kế hoạch cần xóa", success: false }, { status: 400 });
    }
    const plan = await prisma.bulkPlan.findUnique({ where: { id }, select: { facebookPageId: true } });
    if (!plan) return NextResponse.json({ success: true });
    if (!plan.facebookPageId) throw new AccessError("Kế hoạch chưa xác định được Facebook Page", 409);
    await requirePageAccess(plan.facebookPageId, { owner: true });
    await prisma.$transaction([
      prisma.post.deleteMany({ where: { bulkPlanId: id, facebookPageId: plan.facebookPageId } }),
      prisma.bulkPlan.delete({ where: { id } }),
    ]);
    return NextResponse.json({ success: true });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return routeErrorResponse(error, "Lỗi khi xóa");
  }
}
