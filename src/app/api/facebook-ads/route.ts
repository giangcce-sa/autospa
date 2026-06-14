import { NextRequest, NextResponse } from "next/server";
import {
  getCampaigns,
  getInsights,
  setCampaignStatus,
  updateCampaignBudget,
  createFullAd,
} from "@/lib/facebook-ads";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") ?? "campaigns";
  const facebookPageId = searchParams.get("facebookPageId") || undefined;
  const datePreset = searchParams.get("datePreset") ?? "last_7d";

  try {
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
    return NextResponse.json({ error: String(e).replace("Error: ", ""), success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, facebookPageId } = body;
    const pageId = facebookPageId || undefined;

    if (action === "pause" || action === "resume") {
      await setCampaignStatus(body.campaignId, action === "pause" ? "PAUSED" : "ACTIVE", pageId);
      return NextResponse.json({ success: true });
    }

    if (action === "update-budget") {
      await updateCampaignBudget(body.campaignId, Number(body.dailyBudgetVnd), pageId);
      return NextResponse.json({ success: true });
    }

    if (action === "create") {
      const result = await createFullAd({
        name: body.name,
        message: body.message,
        imageUrl: body.imageUrl,
        targetAgeMin: body.targetAgeMin ?? 18,
        targetAgeMax: body.targetAgeMax ?? 55,
        targetGenders: body.targetGenders ?? [],
        targetCountry: body.targetCountry ?? "VN",
        dailyBudgetVnd: body.dailyBudgetVnd,
        startTime: body.startTime,
        endTime: body.endTime,
        objective: body.objective,
        facebookPageId: pageId,
      });
      // Save ad IDs to post if postId provided
      if (body.postId) {
        const { prisma } = await import("@/lib/db");
        await prisma.post.update({
          where: { id: body.postId },
          data: { fbCampaignId: result.campaignId, fbAdId: result.adId },
        });
      }
      return NextResponse.json({ data: result, success: true });
    }

    return NextResponse.json({ error: "Action không hợp lệ", success: false }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e).replace("Error: ", ""), success: false }, { status: 500 });
  }
}
