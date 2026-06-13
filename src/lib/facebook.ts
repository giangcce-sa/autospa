import { prisma } from "./db";

type PageCreds = { token: string; pageId: string };

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
  const url = imageUrl
    ? `https://graph.facebook.com/v21.0/${pageId}/photos`
    : `https://graph.facebook.com/v21.0/${pageId}/feed`;
  const body = imageUrl
    ? { caption: message, url: imageUrl, access_token: token }
    : { message, access_token: token };
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  detectFbError(data);
  return data.id ?? data.post_id;
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
  const { token } = await getPageCreds(facebookPageId);
  const res = await fetch(`https://graph.facebook.com/v21.0/${commentId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, access_token: token }),
  });
  const data = await res.json();
  detectFbError(data);
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
  const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: { id: senderId }, message: { text: message }, access_token: token }),
  });
  const data = await res.json();
  detectFbError(data);
}
