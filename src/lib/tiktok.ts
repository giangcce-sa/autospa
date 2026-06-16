// TikTok Content Posting API — requires TikTok for Business account
// OAuth flow: user grants permission → we receive access_token + open_id

const TIKTOK_API = "https://open.tiktokapis.com/v2";

export interface TikTokUser {
  openId: string;
  displayName: string;
  avatarUrl: string;
  followerCount: number;
  followingCount: number;
  likesCount: number;
  videoCount: number;
}

// Exchange authorization code for tokens (called after OAuth redirect)
export async function exchangeTikTokCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  openId: string;
  expiresIn: number;
  refreshExpiresIn: number;
}> {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  const redirectUri = process.env.TIKTOK_REDIRECT_URI;

  if (!clientKey || !clientSecret || !redirectUri) {
    throw new Error("TikTok credentials not configured (TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_REDIRECT_URI)");
  }

  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`TikTok OAuth: ${data.error_description ?? data.error}`);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    openId: data.open_id,
    expiresIn: data.expires_in,
    refreshExpiresIn: data.refresh_expires_in,
  };
}

// Refresh TikTok access token
export async function refreshTikTokToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: clientKey ?? "",
      client_secret: clientSecret ?? "",
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`TikTok refresh: ${data.error_description ?? data.error}`);
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

// Get TikTok user info
export async function getTikTokUser(accessToken: string, openId: string): Promise<TikTokUser> {
  const fields = "open_id,display_name,avatar_url,follower_count,following_count,likes_count,video_count";
  const res = await fetch(`${TIKTOK_API}/user/info/?fields=${fields}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (data.error?.code !== "ok") throw new Error(`TikTok user: ${data.error?.message}`);
  const u = data.data?.user;
  return {
    openId: u.open_id ?? openId,
    displayName: u.display_name ?? "",
    avatarUrl: u.avatar_url ?? "",
    followerCount: u.follower_count ?? 0,
    followingCount: u.following_count ?? 0,
    likesCount: u.likes_count ?? 0,
    videoCount: u.video_count ?? 0,
  };
}

// Post a photo post to TikTok (Photo Mode — requires v2 Content Posting API)
export async function postPhotoToTikTok(
  accessToken: string,
  openId: string,
  caption: string,
  imageUrls: string[]  // max 35 images, each publicly accessible
): Promise<{ publishId: string }> {
  const body = {
    post_info: {
      title: caption.slice(0, 150),
      description: caption,
      disable_comment: false,
      auto_add_music: true,
    },
    source_info: {
      source: "PULL_FROM_URL",
      photo_images: imageUrls.slice(0, 35).map((url) => ({ url })),
      photo_cover_index: 0,
    },
    post_mode: "DIRECT_POST",
    media_type: "PHOTO",
  };

  const res = await fetch(`${TIKTOK_API}/post/publish/content/init/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.error?.code !== "ok") throw new Error(`TikTok photo post: ${data.error?.message ?? JSON.stringify(data.error)}`);
  return { publishId: data.data?.publish_id };
}

// Post a video to TikTok via URL (Direct Post API)
export async function postVideoToTikTok(
  accessToken: string,
  caption: string,
  videoUrl: string
): Promise<{ publishId: string }> {
  // Step 1: init upload
  const initRes = await fetch(`${TIKTOK_API}/post/publish/video/init/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      post_info: { title: caption.slice(0, 150), privacy_level: "PUBLIC_TO_EVERYONE", disable_duet: false, disable_comment: false, disable_stitch: false },
      source_info: { source: "PULL_FROM_URL", video_url: videoUrl },
      post_mode: "DIRECT_POST",
      media_type: "VIDEO",
    }),
  });
  const initData = await initRes.json();
  if (initData.error?.code !== "ok") throw new Error(`TikTok video init: ${initData.error?.message}`);
  return { publishId: initData.data?.publish_id };
}

export interface TikTokVideoStats {
  videoId: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
}

// Fetch analytics for a posted video
export async function fetchTikTokVideoStats(accessToken: string, videoId: string): Promise<TikTokVideoStats> {
  const fields = "id,view_count,like_count,comment_count,share_count";
  const res = await fetch(`${TIKTOK_API}/video/list/?fields=${fields}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ filters: { video_ids: [videoId] } }),
  });
  const data = await res.json();
  if (data.error?.code !== "ok") throw new Error(`TikTok stats: ${data.error?.message}`);
  const v = data.data?.videos?.[0];
  if (!v) return { videoId, views: 0, likes: 0, comments: 0, shares: 0 };
  return {
    videoId,
    views: v.view_count ?? 0,
    likes: v.like_count ?? 0,
    comments: v.comment_count ?? 0,
    shares: v.share_count ?? 0,
  };
}

// Build the OAuth URL to redirect user for TikTok authorization
export function getTikTokOAuthUrl(state: string): string {
  const clientKey = process.env.TIKTOK_CLIENT_KEY ?? "";
  const redirectUri = encodeURIComponent(process.env.TIKTOK_REDIRECT_URI ?? "");
  const scope = encodeURIComponent("user.info.basic,video.publish,video.upload");
  return `https://www.tiktok.com/v2/auth/authorize/?client_key=${clientKey}&scope=${scope}&response_type=code&redirect_uri=${redirectUri}&state=${state}`;
}
