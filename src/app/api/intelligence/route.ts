import { prisma } from "@/lib/db";
import { aggregateWeeklyInsights } from "@/lib/intelligence/aggregator";
import { syncAdsLibrary } from "@/lib/intelligence/ads-library";
import { syncGoogleTrends } from "@/lib/intelligence/google-trends";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    const [insight, signals] = await Promise.all([
      aggregateWeeklyInsights(),
      prisma.intelligenceSignal.findMany({
        orderBy: { fetchedAt: "desc" },
        take: 50,
      }),
    ]);
    return NextResponse.json({ data: { insight, signals }, success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
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
      return NextResponse.json({
        data: {
          ads: ads.status === "fulfilled" ? ads.value : { error: String(ads.reason) },
          trends: trends.status === "fulfilled" ? trends.value : { error: String(trends.reason) },
        },
        success: true,
      });
    }

    return NextResponse.json({ error: "Source không hợp lệ", success: false }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}
