// Nightly cron: sync new Google reviews + AI auto-reply for negative ones
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { listGbpReviews, replyToGbpReview, refreshGoogleToken } from "@/lib/google-business";
import { generateChatCompletion } from "@/lib/openai";
import { sendAlert } from "@/lib/telegram";

export async function GET() {
  try {
    const account = await prisma.googleAccount.findFirst({ where: { isActive: true } });
    if (!account?.locationId) {
      return NextResponse.json({ success: true, message: "Không có Google Business account" });
    }

    // Refresh token if needed
    let token = account.accessToken;
    if (account.expiresAt && account.expiresAt < new Date(Date.now() + 60000) && account.refreshToken) {
      const fresh = await refreshGoogleToken(account.refreshToken);
      token = fresh.accessToken;
      await prisma.googleAccount.update({
        where: { id: account.id },
        data: { accessToken: fresh.accessToken, expiresAt: new Date(Date.now() + fresh.expiresIn * 1000) },
      });
    }

    const reviews = await listGbpReviews(account.locationId, token);
    const brandKit = await prisma.brandKit.findFirst();
    const spaName = brandKit?.spaName ?? "Spa";
    const settings = await prisma.settings.findFirst();

    let synced = 0;
    let autoReplied = 0;
    let alerted = 0;

    for (const r of reviews) {
      const existing = await prisma.googleReview.findUnique({ where: { reviewId: r.reviewId } });
      const sentiment = r.ratingNum >= 4 ? "positive" : r.ratingNum === 3 ? "neutral" : "negative";

      if (!existing) {
        const created = await prisma.googleReview.create({
          data: {
            reviewId: r.reviewId,
            authorName: r.reviewer.displayName,
            authorPhotoUrl: r.reviewer.profilePhotoUrl ?? null,
            rating: r.ratingNum,
            comment: r.comment ?? null,
            sentiment,
            reply: r.reviewReply?.comment ?? null,
            isReplied: !!r.reviewReply,
            repliedAt: r.reviewReply ? new Date(r.reviewReply.updateTime) : null,
            googleAccountId: account.id,
            updateTime: new Date(r.updateTime),
            createdAt: new Date(r.createTime),
          },
        });
        synced++;

        // Alert for negative reviews (1-2 stars)
        if (r.ratingNum <= 2 && !created.isAlerted) {
          await sendAlert(
            `⚠️ Đánh giá xấu trên Google Maps`,
            `${r.reviewer.displayName} — ${r.ratingNum}★\n"${r.comment?.slice(0, 200) ?? "(Không có bình luận)"}"\n\nVào Google Business để phản hồi ngay.`,
            "warning"
          ).catch(() => {});

          await prisma.googleReview.update({ where: { id: created.id }, data: { isAlerted: true } });
          alerted++;

          // Also save as RealtimeAlert
          await prisma.realtimeAlert.create({
            data: {
              type: "google_negative_review",
              signal: `${r.ratingNum}★ từ ${r.reviewer.displayName}: "${r.comment?.slice(0, 100) ?? ""}"`,
              severity: "critical",
            },
          }).catch(() => {});
        }

        // Auto-reply if in full automation mode and not already replied
        if (settings?.automationLevel === "full" && !r.reviewReply) {
          try {
            const prompt = `Viết phản hồi Google Review thay mặt ${spaName} cho đánh giá ${r.ratingNum} sao từ ${r.reviewer.displayName}: "${r.comment ?? "(không có bình luận)"}". Ngắn gọn 50-70 từ, chân thành, mời quay lại. Chỉ trả về phản hồi.`;
            const reply = await generateChatCompletion(prompt, `Bạn là manager ${spaName}.`);
            await replyToGbpReview(r.name, reply, token);
            await prisma.googleReview.update({
              where: { reviewId: r.reviewId },
              data: { reply, isReplied: true, repliedAt: new Date() },
            });
            autoReplied++;
          } catch { /* skip if auto-reply fails */ }
        }
      }
    }

    return NextResponse.json({ success: true, data: { synced, autoReplied, alerted, total: reviews.length } });
  } catch (e) {
    return NextResponse.json({ error: String(e), success: false }, { status: 500 });
  }
}
