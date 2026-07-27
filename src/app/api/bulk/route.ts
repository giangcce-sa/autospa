import { NextRequest, NextResponse } from "next/server";
import { routeErrorResponse } from "@/lib/api-response";
import {
  bulkDeleteInputSchema,
  bulkPlanInputSchema,
  bulkPlanPostCount,
  parseGeneratedBulkPosts,
} from "@/lib/bulk-plan-policy";
import { generateContent, getBrandContext, getStyleProfile } from "@/lib/claude";
import { prisma } from "@/lib/db";
import { getBulkPlans } from "@/lib/bulk-plans";
import { AccessError, requireExplicitPageAccess, requirePageAccess, requireUser } from "@/lib/page-access";
import { reviewContent } from "@/lib/reviewer";

export async function GET(req: NextRequest) {
  try {
    const facebookPageId = new URL(req.url).searchParams.get("facebookPageId");
    const { page } = await requireExplicitPageAccess(facebookPageId);
    const plans = await getBulkPlans(page!.id);
    return NextResponse.json({ data: plans, success: true });
  } catch (error) {
    return routeErrorResponse(error, "Lỗi khi tải");
  }
}

export async function POST(req: NextRequest) {
  try {
    const input = bulkPlanInputSchema.parse(await req.json());
    const { page } = await requireExplicitPageAccess(input.facebookPageId, { owner: true });
    const pageId = page!.id;

    const [brandContext, styleProfile, services] = await Promise.all([
      getBrandContext(),
      getStyleProfile(pageId),
      prisma.service.findMany({ where: { facebookPageId: pageId, active: true }, take: 10 }),
    ]);

    const totalPosts = bulkPlanPostCount(input.year, input.month, input.postsPerWeek);
    const serviceList = services.map((service) => `- ${service.name} (${service.price ?? "liên hệ"})`).join("\n");
    const typeList = input.postTypes.join(", ");

    const systemPrompt = `Bạn là chuyên gia lập kế hoạch nội dung cho spa.
${brandContext ? `Thông tin spa:\n${brandContext}` : ""}
${styleProfile ? `Văn phong:\n${styleProfile}` : ""}
Viết bằng tiếng Việt.`;

    const prompt = `Tạo kế hoạch ${totalPosts} bài đăng Facebook cho tháng ${input.month}/${input.year}.

Dịch vụ spa:
${serviceList || "Chăm sóc da, triệt lông, massage, giảm béo"}

Loại bài: ${typeList}
Tone: ${input.tone}

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
    const postsData = parseGeneratedBulkPosts(result, input);

    const plan = await prisma.bulkPlan.create({
      data: {
        name: `Kế hoạch tháng ${input.month}/${input.year}`,
        month: input.month,
        year: input.year,
        facebookPageId: pageId,
        posts: {
          create: postsData.map((post) => ({
            caption: post.caption,
            hashtags: post.hashtags,
            postType: post.postType,
            tone: input.tone,
            platform: "facebook",
            status: "draft",
            scheduledAt: new Date(input.year, input.month - 1, post.day, 9, 0),
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
    return routeErrorResponse(err, "Không tạo được kế hoạch");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = bulkDeleteInputSchema.parse(await req.json());
    await requireUser({ owner: true });
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
    return routeErrorResponse(error, "Lỗi khi xóa");
  }
}
