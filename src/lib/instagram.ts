// Instagram Graph API — requires Instagram Business Account linked to a Facebook Page
// Auth: same Facebook user token as the Facebook Page
import { signedMediaUrl, storageKeyFromMediaUrl } from "./media-storage";

const IG_API = "https://graph.facebook.com/v21.0";

function publishableImageUrl(imageUrl: string) {
  const storageKey = storageKeyFromMediaUrl(imageUrl);
  return storageKey ? signedMediaUrl(storageKey, 1800) : imageUrl;
}

export interface IgAccount {
  id: string;
  username: string;
  name: string;
  followersCount: number;
  mediaCount: number;
}

// Discover Instagram Business account linked to a Facebook Page
export async function getLinkedIgAccount(fbPageId: string, accessToken: string): Promise<IgAccount | null> {
  const url = `${IG_API}/${fbPageId}?fields=instagram_business_account{id,username,name,followers_count,media_count}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json();
  if (!data.instagram_business_account) return null;
  const ig = data.instagram_business_account;
  return {
    id: ig.id,
    username: ig.username ?? "",
    name: ig.name ?? ig.username ?? "",
    followersCount: ig.followers_count ?? 0,
    mediaCount: ig.media_count ?? 0,
  };
}

// Post image to Instagram (requires published image URL — must be publicly accessible)
export async function postToInstagram(
  igAccountId: string,
  accessToken: string,
  caption: string,
  imageUrl: string
): Promise<string> {
  const publicImageUrl = publishableImageUrl(imageUrl);
  // Step 1: Create media container
  const containerRes = await fetch(`${IG_API}/${igAccountId}/media`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ image_url: publicImageUrl, caption }),
  });
  const containerData = await containerRes.json();
  if (containerData.error) throw new Error(`IG media create: ${containerData.error.message}`);
  const creationId: string = containerData.id;

  // Step 2: Publish
  const publishRes = await fetch(`${IG_API}/${igAccountId}/media_publish`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ creation_id: creationId }),
  });
  const publishData = await publishRes.json();
  if (publishData.error) throw new Error(`IG publish: ${publishData.error.message}`);
  return publishData.id;
}

export async function postVideoToInstagram(
  igAccountId: string,
  accessToken: string,
  caption: string,
  videoUrl: string,
): Promise<string> {
  const storageKey = storageKeyFromMediaUrl(videoUrl);
  const publicVideoUrl = storageKey ? signedMediaUrl(storageKey, 3600) : videoUrl;
  const containerRes = await fetch(`${IG_API}/${igAccountId}/media`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ media_type: "REELS", video_url: publicVideoUrl, caption, share_to_feed: true }),
  });
  const containerData = await containerRes.json();
  if (containerData.error) throw new Error(`IG Reels create: ${containerData.error.message}`);
  const creationId: string = containerData.id;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5_000));
    const statusRes = await fetch(`${IG_API}/${creationId}?fields=status_code,status`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const statusData = await statusRes.json();
    if (statusData.status_code === "FINISHED") break;
    if (statusData.status_code === "ERROR" || statusData.error) throw new Error(`IG Reels xử lý lỗi: ${statusData.status || statusData.error?.message}`);
    if (attempt === 23) throw new Error("Instagram xử lý video quá thời gian");
  }
  const publishRes = await fetch(`${IG_API}/${igAccountId}/media_publish`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ creation_id: creationId }),
  });
  const publishData = await publishRes.json();
  if (publishData.error) throw new Error(`IG Reels publish: ${publishData.error.message}`);
  return publishData.id;
}

// Post carousel to Instagram (multiple images)
export async function postIgCarousel(
  igAccountId: string,
  accessToken: string,
  caption: string,
  imageUrls: string[]
): Promise<string> {
  // Create child containers
  const childIds: string[] = [];
  for (const url of imageUrls.slice(0, 10)) {
    const publicUrl = publishableImageUrl(url);
    const res = await fetch(`${IG_API}/${igAccountId}/media`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ image_url: publicUrl, is_carousel_item: true }),
    });
    const data = await res.json();
    if (data.error) throw new Error(`IG carousel child: ${data.error.message}`);
    childIds.push(data.id);
  }

  // Create carousel container
  const carouselRes = await fetch(`${IG_API}/${igAccountId}/media`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ media_type: "CAROUSEL", caption, children: childIds.join(",") }),
  });
  const carouselData = await carouselRes.json();
  if (carouselData.error) throw new Error(`IG carousel: ${carouselData.error.message}`);

  // Publish
  const publishRes = await fetch(`${IG_API}/${igAccountId}/media_publish`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ creation_id: carouselData.id }),
  });
  const publishData = await publishRes.json();
  if (publishData.error) throw new Error(`IG carousel publish: ${publishData.error.message}`);
  return publishData.id;
}

export interface IgInsights {
  igPostId: string;
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  saved: number;
}

// Fetch metrics for a published IG post
export async function fetchIgInsights(igPostId: string, accessToken: string): Promise<IgInsights> {
  const metrics = "reach,impressions,likes_count,comments_count,saved";
  const url = `${IG_API}/${igPostId}?fields=${metrics}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json();
  if (data.error) throw new Error(`IG insights: ${data.error.message}`);

  return {
    igPostId,
    reach: data.reach ?? 0,
    impressions: data.impressions ?? 0,
    likes: data.likes_count ?? 0,
    comments: data.comments_count ?? 0,
    saved: data.saved ?? 0,
  };
}

// Fetch recent IG posts for analytics
export async function fetchIgMedia(igAccountId: string, accessToken: string, limit = 20) {
  const fields = "id,caption,media_type,timestamp,like_count,comments_count,reach,impressions";
  const url = `${IG_API}/${igAccountId}/media?fields=${fields}&limit=${limit}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await res.json();
  if (data.error) throw new Error(`IG media list: ${data.error.message}`);
  return (data.data ?? []) as {
    id: string; caption?: string; media_type: string; timestamp: string;
    like_count: number; comments_count: number; reach?: number; impressions?: number;
  }[];
}
