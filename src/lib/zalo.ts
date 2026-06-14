import { prisma } from "./db";

export async function postToZalo(message: string, imageUrl?: string, recipientId?: string): Promise<string> {
  const settings = await prisma.settings.findFirst();
  if (!settings?.zaloToken) throw new Error("Chưa cấu hình Zalo Token");

  const endpoint = "https://openapi.zalo.me/v2.0/oa/message/cs";

  // recipientId: gửi đến user cụ thể (approval, staff notify)
  // Không có recipientId: broadcast OA (dùng zaloOaId)
  if (!recipientId && !settings.zaloOaId) throw new Error("Chưa cấu hình Zalo OA ID");
  const recipient = recipientId
    ? { user_id: recipientId }
    : { oa_id: settings.zaloOaId! };

  const payload = {
    recipient,
    message: imageUrl
      ? { attachment: { type: "template", payload: { template_type: "media", elements: [{ media_type: "image", url: imageUrl }] } }, text: message }
      : { text: message },
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", access_token: settings.zaloToken },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (data.error !== 0) throw new Error(data.message ?? "Lỗi Zalo API");
  return data.data?.message_id ?? "ok";
}
