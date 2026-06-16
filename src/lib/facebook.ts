import { prisma } from "./db";
import { withRateLimit } from "./rate-limiter";

type PageCreds = { token: string; pageId: string };

// FB Graph API: ~200 calls/hour/page → cap an toàn 180/h
const FB_LIMIT = 180;
const FB_WINDOW = 3600;

async function fbRateKey(pageId: string): Promise<string> {
  return `fb:${pageId}`;
}

async function getPageCreds(facebookPageId?: string): Promise<PageCreds> {
  let page;
  if (facebookPageId) {
    page = await prisma.facebookPage.findUnique({ where: { id: facebookPageId } });
  } else {
    page = await prisma.facebookPage.findFirst({ where: { isActive: true } });
  }
  if (!page) throw new Error("Chưa cấu hình Facebook Page");
  return { token: page.accessToken, pageId: page.fbPageId };
}

function detectFbError(data: { error?: { message: string; code?: number } }) {
  if (!data.error) return;
  const msg = data.error.message;
  const code = data.error.code;
  if (code === 200 || msg.includes("pages_manage_posts") || msg.includes("publish_to_groups")) throw new Error("FB_NO_MANAGE_POSTS");
  if (msg.toLowerCase().includes("invalid") && msg.toLowerCase().includes("token")) throw new Error("FB_TOKEN_INVALID");
  if (msg.includes("pages_read_engagement") || msg.includes("pages_messaging")) throw new Error("FB_NO_PERMISSION");
  throw new Error(msg);
}

export async function postToFacebook(message: string, imageUrl?: string, facebookPageId?: string): Promise<string> {
  const { token, pageId } = await getPageCreds(facebookPageId);
  const rateKey = await fbRateKey(pageId);

  return withRateLimit(rateKey, FB_LIMIT, FB_WINDOW, async () => {
  if (imageUrl) {
    // Step 1: Upload image privately (published=false) to get a media_fbid.
    // Then Step 2: publish as a proper feed post with attached_media.
    // This ensures the post appears on the Page timeline as a feed story,
    // not just silently added to a photo album.
    const formData = new FormData();
    if (imageUrl.startsWith("data:")) {
      const [header, b64] = imageUrl.split(",");
      const mimeType = header.match(/data:([^;]+)/)?.[1] ?? "image/png";
      const buffer = Buffer.from(b64, "base64");
      formData.append("source", new Blob([buffer], { type: mimeType }), "image.png");
    } else {
      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) throw new Error(`Không tải được ảnh (${imgRes.status})`);
      formData.append("source", await imgRes.blob(), "image.png");
    }
    formData.append("published", "false"); // stage the photo, don't publish yet
    formData.append("access_token", token);

    const uploadRes = await fetch(`https://graph.facebook.com/v21.0/${pageId}/photos`, { method: "POST", body: formData });
    const uploadData = await uploadRes.json();
    detectFbError(uploadData);
    const photoId: string = uploadData.id;

    // Step 2: create a feed post with the staged photo attached
    const feedRes = await fetch(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        attached_media: [{ media_fbid: photoId }],
        access_token: token,
      }),
    });
    const feedData = await feedRes.json();
    detectFbError(feedData);
    return feedData.id ?? feedData.post_id;
  }

  // Text-only post
  const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, access_token: token }),
  });
  const data = await res.json();
  detectFbError(data);
  return data.id ?? data.post_id;
  });
}

export interface FbComment {
  fbCommentId: string;
  fbPostId: string;
  postCaption: string;
  authorName: string;
  content: string;
  createdTime: string;
}

export async function fetchFbComments(postLimit = 10, facebookPageId?: string): Promise<FbComment[]> {
  const { token, pageId } = await getPageCreds(facebookPageId);
  const fields = "id,message,comments.limit(50){id,message,from,created_time}";
  const url = `https://graph.facebook.com/v21.0/${pageId}/posts?fields=${fields}&limit=${postLimit}&access_token=${token}`;
  const res = await fetch(url);
  const data = await res.json();
  detectFbError(data);
  const result: FbComment[] = [];
  for (const post of data.data ?? []) {
    for (const c of post.comments?.data ?? []) {
      if (!c.message) continue;
      result.push({
        fbCommentId: c.id,
        fbPostId: post.id,
        postCaption: post.message ?? "",
        authorName: c.from?.name ?? "Khách hàng",
        content: c.message,
        createdTime: c.created_time,
      });
    }
  }
  return result;
}

export async function replyToFbComment(commentId: string, message: string, facebookPageId?: string): Promise<void> {
  const { token, pageId } = await getPageCreds(facebookPageId);
  const rateKey = await fbRateKey(pageId);
  await withRateLimit(rateKey, FB_LIMIT, FB_WINDOW, async () => {
    const res = await fetch(`https://graph.facebook.com/v21.0/${commentId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, access_token: token }),
    });
    const data = await res.json();
    detectFbError(data);
  });
}

export interface FbMessage {
  conversationId: string;
  senderId: string;
  senderName: string;
  message: string;
  createdTime: string;
}

export async function fetchFbConversations(limit = 20, facebookPageId?: string): Promise<FbMessage[]> {
  const { token, pageId } = await getPageCreds(facebookPageId);
  const fields = "id,participants,messages.limit(1){message,from,created_time,id}";
  const url = `https://graph.facebook.com/v21.0/${pageId}/conversations?fields=${fields}&limit=${limit}&access_token=${token}`;
  const res = await fetch(url);
  const data = await res.json();
  detectFbError(data);
  const result: FbMessage[] = [];
  for (const conv of data.data ?? []) {
    const lastMsg = conv.messages?.data?.[0];
    if (!lastMsg?.message) continue;
    if (lastMsg.from?.id === pageId) continue;
    const sender = conv.participants?.data?.find((p: { id: string }) => p.id !== pageId);
    result.push({
      conversationId: conv.id,
      senderId: sender?.id ?? lastMsg.from?.id ?? conv.id,
      senderName: sender?.name ?? lastMsg.from?.name ?? "Khách hàng",
      message: lastMsg.message,
      createdTime: lastMsg.created_time,
    });
  }
  return result;
}

export async function replyToFbConversation(senderId: string, message: string, facebookPageId?: string): Promise<void> {
  const { token, pageId } = await getPageCreds(facebookPageId);
  const rateKey = await fbRateKey(pageId);
  await withRateLimit(rateKey, FB_LIMIT, FB_WINDOW, async () => {
    const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipient: { id: senderId }, message: { text: message }, access_token: token }),
    });
    const data = await res.json();
    detectFbError(data);
  });
}
