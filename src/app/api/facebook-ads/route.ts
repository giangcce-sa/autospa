import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adsMutationErrorResponse } from "@/lib/ads-safety";
import { accessErrorResponse, requirePageAccess } from "@/lib/page-access";
import {
  getCampaigns,
  getInsights,
  setCampaignStatus,
  updateAdsBudget,
  createFullAd,
} from "@/lib/facebook-ads";

const createAdSchema = z.object({
  idempotencyKey: z.string().uuid(),
  postId: z.string().min(1),
  name: z.string().trim().min(1).max(70),
  targetAgeMin: z.number().int().min(18).max(65),
  targetAgeMax: z.number().int().min(18).max(65),
  targetGenders: z.array(z.union([z.literal(1), z.literal(2)])).max(2),
  targetCountry: z.literal("VN"),
  dailyBudgetVnd: z.number().int().min(20_000).max(2_000_000),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  objective: z.literal("OUTCOME_AWARENESS"),
}).superRefine((value, context) => {
  if (value.targetAgeMin > value.targetAgeMax) {
    context.addIssue({ code: "custom", path: ["targetAgeMax"], message: "Tuổi tối đa phải lớn hơn tuổi tối thiểu" });
  }
  if (value.startTime && value.endTime && new Date(value.startTime) >= new Date(value.endTime)) {
    context.addIssue({ code: "custom", path: ["endTime"], message: "Ngày kết thúc phải sau ngày bắt đầu" });
  }
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") ?? "campaigns";
  const facebookPageId = searchParams.get("facebookPageId") || undefined;
  const datePreset = searchParams.get("datePreset") ?? "last_7d";

  try {
    if (!facebookPageId) {
      return NextResponse.json({ error: "Hãy chọn Facebook Page", success: false }, { status: 400 });
    }
    await requirePageAccess(facebookPageId);
    if (action === "campaigns") {
      const data = await getCampaigns(facebookPageId);
      return NextResponse.json({ data, success: true });
    }
    if (action === "insights") {
      const data = await getInsights(facebookPageId, datePreset);
      return NextResponse.json({ data, success: true });
    }
    return NextResponse.json({ error: "Action không hợp lệ", success: false }, { status: 400 });
  } catch (e) {
    const access = accessErrorResponse(e);
    if (access) return access;
    const blocked = adsMutationErrorResponse(e);
    if (blocked) return blocked;
    return NextResponse.json({ error: String(e).replace("Error: ", ""), success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, facebookPageId } = body;
    const pageId = facebookPageId || undefined;
    if (!pageId) {
      return NextResponse.json({ error: "Hãy chọn Facebook Page", success: false }, { status: 400 });
    }

    const { user } = await requirePageAccess(pageId, { owner: true });

    if (action === "pause" || action === "resume") {
      await setCampaignStatus(body.campaignId, action === "pause" ? "PAUSED" : "ACTIVE", pageId);
      return NextResponse.json({ success: true });
    }

    if (action === "update-budget") {
      if (!body.campaignId || !body.targetId || !["campaign", "adset"].includes(body.targetType)) {
        return NextResponse.json({ error: "Budget target không hợp lệ", success: false }, { status: 400 });
      }
      await updateAdsBudget({
        campaignId: body.campaignId,
        targetId: body.targetId,
        targetType: body.targetType,
        dailyBudgetVnd: Number(body.dailyBudgetVnd),
        facebookPageId: pageId,
      });
      return NextResponse.json({ success: true });
    }

    if (action === "create") {
      const parsed = createAdSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dữ liệu quảng cáo không hợp lệ", success: false }, { status: 400 });
      }
      if (!user.id) {
        return NextResponse.json({ error: "Phiên đăng nhập thiếu định danh người dùng", success: false }, { status: 401 });
      }
      const { prisma } = await import("@/lib/db");
      const post = await prisma.post.findFirst({
        where: { id: parsed.data.postId, facebookPageId: pageId },
        select: {
          id: true,
          caption: true,
          hashtags: true,
          imageUrl: true,
          review: { select: { status: true } },
        },
      });
      if (!post) {
        return NextResponse.json({ error: "Nội dung không thuộc Facebook Page đã chọn", success: false }, { status: 403 });
      }
      if (!post.imageUrl) {
        return NextResponse.json({ error: "Nội dung quảng cáo phải có hình ảnh", success: false }, { status: 400 });
      }
      if (post.review?.status !== "pass") {
        return NextResponse.json({ error: "Nội dung phải vượt qua kiểm duyệt trước khi quảng cáo", success: false }, { status: 400 });
      }
      const result = await createFullAd({
        idempotencyKey: parsed.data.idempotencyKey,
        postId: post.id,
        actorId: user.id,
        name: parsed.data.name,
        message: [post.caption, post.hashtags].filter(Boolean).join("\n\n"),
        imageUrl: post.imageUrl,
        targetAgeMin: parsed.data.targetAgeMin,
        targetAgeMax: parsed.data.targetAgeMax,
        targetGenders: parsed.data.targetGenders,
        targetCountry: parsed.data.targetCountry,
        dailyBudgetVnd: parsed.data.dailyBudgetVnd,
        startTime: parsed.data.startTime,
        endTime: parsed.data.endTime,
        objective: parsed.data.objective,
        facebookPageId: pageId,
      });
      return NextResponse.json({ data: result, success: true });
    }

    return NextResponse.json({ error: "Action không hợp lệ", success: false }, { status: 400 });
  } catch (e) {
    const access = accessErrorResponse(e);
    if (access) return access;
    const blocked = adsMutationErrorResponse(e);
    if (blocked) return blocked;
    return NextResponse.json({ error: String(e).replace("Error: ", ""), success: false }, { status: 500 });
  }
}
