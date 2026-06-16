// Google Business Profile API v1 + My Business API v4
// Auth: OAuth 2.0 with scope: https://www.googleapis.com/auth/business.manage

const GBP_ACCOUNT_MGMT = "https://mybusinessaccountmanagement.googleapis.com/v1";
const GBP_INFO = "https://mybusinessbusinessinformation.googleapis.com/v1";
const GBP_V4 = "https://mybusiness.googleapis.com/v4";
const GBP_PERFORMANCE = "https://businessprofileperformance.googleapis.com/v1";

// ─── OAuth ───────────────────────────────────────────────────────────────────

export function getGoogleOAuthUrl(state: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
  const redirectUri = encodeURIComponent(process.env.GOOGLE_REDIRECT_URI ?? "");
  const scope = encodeURIComponent(
    "https://www.googleapis.com/auth/business.manage https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile"
  );
  return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${state}`;
}

export async function exchangeGoogleCode(code: string): Promise<{
  accessToken: string; refreshToken: string; expiresIn: number;
  email: string; displayName: string;
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
  const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? "";

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Google OAuth credentials not configured (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI)");
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
  });
  const tokenData = await tokenRes.json();
  if (tokenData.error) throw new Error(`Google token: ${tokenData.error_description ?? tokenData.error}`);

  // Fetch user info
  const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const userInfo = await userRes.json();

  return {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token ?? "",
    expiresIn: tokenData.expires_in ?? 3600,
    email: userInfo.email ?? "",
    displayName: userInfo.name ?? userInfo.email ?? "",
  };
}

export async function refreshGoogleToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`Google refresh: ${data.error_description ?? data.error}`);
  return { accessToken: data.access_token, expiresIn: data.expires_in ?? 3600 };
}

// ─── Account & Location discovery ────────────────────────────────────────────

export interface GbpAccount {
  name: string;       // e.g. "accounts/123456789"
  accountName: string; // human-readable
  type: string;
}

export async function listGbpAccounts(accessToken: string): Promise<GbpAccount[]> {
  const res = await fetch(`${GBP_ACCOUNT_MGMT}/accounts`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (data.error) throw new Error(`GBP accounts: ${data.error.message}`);
  return (data.accounts ?? []) as GbpAccount[];
}

export interface GbpLocation {
  name: string;       // e.g. "accounts/123/locations/456"
  title: string;      // business name
  phoneNumbers?: { primaryPhone?: string };
  websiteUri?: string;
  regularHours?: unknown;
}

export async function listGbpLocations(accountName: string, accessToken: string): Promise<GbpLocation[]> {
  const fields = "name,title,phoneNumbers,websiteUri,regularHours";
  const url = `${GBP_INFO}/${accountName}/locations?readMask=${fields}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json();
  if (data.error) throw new Error(`GBP locations: ${data.error.message}`);
  return (data.locations ?? []) as GbpLocation[];
}

// ─── Reviews ─────────────────────────────────────────────────────────────────

export type GbpRating = "ONE" | "TWO" | "THREE" | "FOUR" | "FIVE";

const RATING_MAP: Record<GbpRating, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

export interface GbpReview {
  name: string;
  reviewId: string;
  reviewer: { displayName: string; profilePhotoUrl?: string };
  starRating: GbpRating;
  comment?: string;
  createTime: string;
  updateTime: string;
  reviewReply?: { comment: string; updateTime: string };
  ratingNum: number;
}

export async function listGbpReviews(locationName: string, accessToken: string, pageSize = 50): Promise<GbpReview[]> {
  const url = `${GBP_V4}/${locationName}/reviews?pageSize=${pageSize}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json();
  if (data.error) throw new Error(`GBP reviews: ${data.error.message}`);
  return ((data.reviews ?? []) as (Omit<GbpReview, "ratingNum"> & { starRating: GbpRating })[]).map((r) => ({
    ...r,
    ratingNum: RATING_MAP[r.starRating] ?? 3,
  }));
}

export async function replyToGbpReview(reviewName: string, comment: string, accessToken: string): Promise<void> {
  const url = `${GBP_V4}/${reviewName}/reply`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ comment }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`GBP reply: ${data.error.message}`);
}

export async function deleteGbpReviewReply(reviewName: string, accessToken: string): Promise<void> {
  const url = `${GBP_V4}/${reviewName}/reply`;
  await fetch(url, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } });
}

// ─── Local Posts ─────────────────────────────────────────────────────────────

type GbpCTA = "BOOK" | "CALL" | "LEARN_MORE" | "ORDER" | "SHOP" | "SIGN_UP";

export interface GbpPostInput {
  summary: string;
  callToActionType?: GbpCTA;
  callToActionUrl?: string;
  mediaUrl?: string;
}

export async function createGbpPost(locationName: string, post: GbpPostInput, accessToken: string): Promise<string> {
  const body: Record<string, unknown> = { summary: post.summary, languageCode: "vi" };

  if (post.callToActionType && post.callToActionUrl) {
    body.callToAction = { actionType: post.callToActionType, url: post.callToActionUrl };
  }

  if (post.mediaUrl) {
    body.media = [{ mediaFormat: "PHOTO", sourceUrl: post.mediaUrl }];
  }

  const url = `${GBP_V4}/${locationName}/localPosts`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.error) throw new Error(`GBP post: ${data.error.message}`);
  return data.name ?? "";
}

export async function listGbpPosts(locationName: string, accessToken: string): Promise<{
  name: string; summary: string; state: string; createTime: string;
}[]> {
  const url = `${GBP_V4}/${locationName}/localPosts?pageSize=20`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json();
  if (data.error) throw new Error(`GBP list posts: ${data.error.message}`);
  return data.localPosts ?? [];
}

// ─── Insights / Performance ───────────────────────────────────────────────────

export interface GbpInsights {
  views: number;         // total profile views
  searches: number;      // direct + discovery searches
  websiteClicks: number;
  callClicks: number;
  directionRequests: number;
  period: string;        // "last 30 days"
}

export async function fetchGbpInsights(locationId: string, accessToken: string): Promise<GbpInsights> {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 30 * 86400000);

  const fmt = (d: Date) => ({ year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() });

  const metrics = ["BUSINESS_IMPRESSIONS_DESKTOP_MAPS", "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
    "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH", "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
    "CALL_CLICKS", "WEBSITE_CLICKS", "BUSINESS_DIRECTION_REQUESTS"];

  const results: Record<string, number> = {};

  await Promise.allSettled(
    metrics.map(async (metric) => {
      const url = `${GBP_PERFORMANCE}/${locationId}:getDailyMetricsTimeSeries?dailyMetric=${metric}&dailyRange.start_date.year=${fmt(startDate).year}&dailyRange.start_date.month=${fmt(startDate).month}&dailyRange.start_date.day=${fmt(startDate).day}&dailyRange.end_date.year=${fmt(endDate).year}&dailyRange.end_date.month=${fmt(endDate).month}&dailyRange.end_date.day=${fmt(endDate).day}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      const data = await res.json();
      if (!data.error) {
        const total = (data.timeSeries?.datedValues ?? []).reduce(
          (sum: number, d: { value?: string | number }) => sum + (parseInt(String(d.value ?? "0")) || 0), 0
        );
        results[metric] = total;
      }
    })
  );

  return {
    views: (results["BUSINESS_IMPRESSIONS_DESKTOP_MAPS"] ?? 0) +
           (results["BUSINESS_IMPRESSIONS_MOBILE_MAPS"] ?? 0) +
           (results["BUSINESS_IMPRESSIONS_DESKTOP_SEARCH"] ?? 0) +
           (results["BUSINESS_IMPRESSIONS_MOBILE_SEARCH"] ?? 0),
    searches: (results["BUSINESS_IMPRESSIONS_DESKTOP_SEARCH"] ?? 0) +
              (results["BUSINESS_IMPRESSIONS_MOBILE_SEARCH"] ?? 0),
    websiteClicks: results["WEBSITE_CLICKS"] ?? 0,
    callClicks: results["CALL_CLICKS"] ?? 0,
    directionRequests: results["BUSINESS_DIRECTION_REQUESTS"] ?? 0,
    period: "30 ngày gần đây",
  };
}
