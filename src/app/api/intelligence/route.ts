import { prisma } from "@/lib/db";
import { aggregateWeeklyInsights } from "@/lib/intelligence/aggregator";
import { syncAdsLibrary } from "@/lib/intelligence/ads-library";
import { syncGoogleTrends } from "@/lib/intelligence/google-trends";
import { accessErrorResponse, requireUser } from "@/lib/page-access";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    await requireUser();
    const [insight, signals] = await Promise.all([
      aggregateWeeklyInsights(),
      prisma.intelligenceSignal.findMany({
        orderBy: { fetchedAt: "desc" },
        take: 50,
      }),
    ]);
    return NextResponse.json({ data: { insight, signals }, success: true });
  } catch (err) {
    const access = accessErrorResponse(err);
    if (access) return access;
    console.error("intelligence load failed:", err);
    return NextResponse.json({ error: "Lỗi khi tải", success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // External API sync + DB writes — owner only
    await requireUser({ owner: true });
    const body = await req.json();
    const { source } = body;

    if (source === "ads_library") {
      const result = await syncAdsLibrary();
      return NextResponse.json({ data: result, success: true });
    }
    if (source === "google_trends") {
      const result = await syncGoogleTrends();
      return NextResponse.json({ data: result, success: true });
    }
    if (source === "all") {
      const [ads, trends] = await Promise.allSettled([syncAdsLibrary(), syncGoogleTrends()]);
      if (ads.status === "rejected") console.error("ads_library sync failed:", ads.reason);
      if (trends.status === "rejected") console.error("google_trends sync failed:", trends.reason);
      return NextResponse.json({
        data: {
          ads: ads.status === "fulfilled" ? ads.value : { error: "Đồng bộ thất bại" },
          trends: trends.status === "fulfilled" ? trends.value : { error: "Đồng bộ thất bại" },
        },
        success: true,
      });
    }

    return NextResponse.json({ error: "Source không hợp lệ", success: false }, { status: 400 });
  } catch (err) {
    const access = accessErrorResponse(err);
    if (access) return access;
    console.error("intelligence sync failed:", err);
    return NextResponse.json({ error: "Lỗi khi đồng bộ", success: false }, { status: 500 });
  }
}
