// Instagram Graph API — requires Instagram Business Account linked to a Facebook Page
// Auth: same Facebook user token as the Facebook Page

const IG_API = "https://graph.facebook.com/v21.0";

export interface IgAccount {
  id: string;
  username: string;
  name: string;
  followersCount: number;
  mediaCount: number;
}

// Discover Instagram Business account linked to a Facebook Page
export async function getLinkedIgAccount(fbPageId: string, accessToken: string): Promise<IgAccount | null> {
  const url = `${IG_API}/${fbPageId}?fields=instagram_business_account{id,username,name,followers_count,media_count}&access_token=${accessToken}`;
  const res = await fetch(url);
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
  // Step 1: Create media container
  const containerRes = await fetch(`${IG_API}/${igAccountId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: imageUrl, caption, access_token: accessToken }),
  });
  const containerData = await containerRes.json();
  if (containerData.error) throw new Error(`IG media create: ${containerData.error.message}`);
  const creationId: string = containerData.id;

  // Step 2: Publish
  const publishRes = await fetch(`${IG_API}/${igAccountId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: creationId, access_token: accessToken }),
  });
  const publishData = await publishRes.json();
  if (publishData.error) throw new Error(`IG publish: ${publishData.error.message}`);
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
    const res = await fetch(`${IG_API}/${igAccountId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: url, is_carousel_item: true, access_token: accessToken }),
    });
    const data = await res.json();
    if (data.error) throw new Error(`IG carousel child: ${data.error.message}`);
    childIds.push(data.id);
  }

  // Create carousel container
  const carouselRes = await fetch(`${IG_API}/${igAccountId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ media_type: "CAROUSEL", caption, children: childIds.join(","), access_token: accessToken }),
  });
  const carouselData = await carouselRes.json();
  if (carouselData.error) throw new Error(`IG carousel: ${carouselData.error.message}`);

  // Publish
  const publishRes = await fetch(`${IG_API}/${igAccountId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: carouselData.id, access_token: accessToken }),
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
  const url = `${IG_API}/${igPostId}?fields=${metrics}&access_token=${accessToken}`;
  const res = await fetch(url);
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
  const url = `${IG_API}/${igAccountId}/media?fields=${fields}&limit=${limit}&access_token=${accessToken}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) throw new Error(`IG media list: ${data.error.message}`);
  return (data.data ?? []) as {
    id: string; caption?: string; media_type: string; timestamp: string;
    like_count: number; comments_count: number; reach?: number; impressions?: number;
  }[];
}
