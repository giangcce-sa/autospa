import { prisma } from "../db";

/**
 * Fetch active ads from Facebook Ads Library API.
 * Requires Page access token with ads_read permission (works on FB Page Access Token).
 * Public ads — anyone can see.
 *
 * https://developers.facebook.com/docs/graph-api/reference/ads_archive/
 */
interface AdsLibraryEntry {
  id: string;
  ad_creative_bodies?: string[];
  page_name?: string;
  ad_delivery_start_time?: string;
}

const BEAUTY_KEYWORDS = ["spa", "trẻ hóa da", "triệt lông", "facial", "thẩm mỹ", "skincare", "làm đẹp"];

async function fetchAdsForKeyword(keyword: string, token: string, limit = 25): Promise<AdsLibraryEntry[]> {
  const url = new URL("https://graph.facebook.com/v21.0/ads_archive");
  url.searchParams.set("ad_active_status", "ACTIVE");
  url.searchParams.set("ad_reached_countries", "VN");
  url.searchParams.set("ad_type", "ALL");
  url.searchParams.set("search_terms", keyword);
  url.searchParams.set("fields", "id,ad_creative_bodies,page_name,ad_delivery_start_time");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("access_token", token);

  const res = await fetch(url.toString());
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return (data.data ?? []) as AdsLibraryEntry[];
}

/**
 * Pull ads library for beauty keywords, save signals.
 * Returns count of new signals.
 */
export async function syncAdsLibrary(): Promise<{ saved: number; errors: string[] }> {
  // Use the first active FB Page's access token
  const fbPage = await prisma.facebookPage.findFirst({ where: { isActive: true } });
  if (!fbPage) return { saved: 0, errors: ["Chưa cấu hình FB Page để dùng làm access token"] };

  const errors: string[] = [];
  let saved = 0;

  for (const kw of BEAUTY_KEYWORDS) {
    try {
      const ads = await fetchAdsForKeyword(kw, fbPage.accessToken);
      // Count unique pages running ads for this keyword
      const pages = new Set(ads.map((a) => a.page_name).filter(Boolean) as string[]);
      const volume = pages.size;

      // Determine trend: compare with previous fetch for this keyword
      const previous = await prisma.intelligenceSignal.findFirst({
        where: { source: "fb_ads_library", topic: kw },
        orderBy: { fetchedAt: "desc" },
      });

      let trend: "rising" | "stable" | "falling" = "stable";
      if (previous) {
        if (volume > previous.volume * 1.2) trend = "rising";
        else if (volume < previous.volume * 0.8) trend = "falling";
      }

      await prisma.intelligenceSignal.create({
        data: {
          source: "fb_ads_library",
          topic: kw,
          volume,
          trend,
          details: JSON.stringify({ activePages: Array.from(pages).slice(0, 10), totalAds: ads.length }),
        },
      });
      saved++;
    } catch (e) {
      errors.push(`${kw}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { saved, errors };
}
