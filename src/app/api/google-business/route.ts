import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  getGoogleOAuthUrl, listGbpAccounts, listGbpLocations,
  listGbpReviews, replyToGbpReview, deleteGbpReviewReply,
  createGbpPost, listGbpPosts, fetchGbpInsights, refreshGoogleToken,
} from "@/lib/google-business";
import { generateChatCompletion } from "@/lib/openai";

// Ensure access token is fresh, refresh if needed
async function getValidToken(accountId: string): Promise<{ token: string; account: { id: string; locationId: string | null; accountId: string | null; locationName: string | null } }> {
  const account = await prisma.googleAccount.findUnique({ where: { id: accountId } });
  if (!account) throw new Error("Google account không tìm thấy");

  if (account.expiresAt && account.expiresAt < new Date(Date.now() + 60000) && account.refreshToken) {
    const fresh = await refreshGoogleToken(account.refreshToken);
    await prisma.googleAccount.update({
      where: { id: accountId },
      data: { accessToken: fresh.accessToken, expiresAt: new Date(Date.now() + fresh.expiresIn * 1000) },
    });
    return { token: fresh.accessToken, account };
  }

  return { token: account.accessToken, account };
}

// Get the primary active account's ID
async function getPrimaryAccountId(): Promise<string | null> {
  const account = await prisma.googleAccount.findFirst({ where: { isActive: true } });
  return account?.id ?? null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    if (action === "auth-url") {
      const state = Math.random().toString(36).slice(2);
      const url = getGoogleOAuthUrl(state);
      return NextResponse.json({ success: true, data: { url, state } });
    }

    if (action === "accounts") {
      const accounts = await prisma.googleAccount.findMany({
        select: { id: true, email: true, displayName: true, accountId: true, locationId: true, locationName: true, isActive: true, expiresAt: true },
      });
      return NextResponse.json({ success: true, data: accounts });
    }

    const primaryId = await getPrimaryAccountId();

    if (action === "discover-locations") {
      if (!primaryId) return NextResponse.json({ success: false, message: "Chưa kết nối Google" }, { status: 400 });
      const { token, account } = await getValidToken(primaryId);
      if (!account.accountId) return NextResponse.json({ success: false, message: "Chưa có GBP account" }, { status: 400 });
      const locations = await listGbpLocations(account.accountId, token);
      return NextResponse.json({ success: true, data: locations });
    }

    if (action === "reviews") {
      // Return cached reviews from DB
      const reviews = await prisma.googleReview.findMany({
        orderBy: [{ rating: "asc" }, { updateTime: "desc" }],
        take: 100,
      });
      const stats = {
        total: reviews.length,
        avgRating: reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0,
        byRating: [1, 2, 3, 4, 5].map((r) => ({ rating: r, count: reviews.filter((rv) => rv.rating === r).length })),
        unreplied: reviews.filter((r) => !r.isReplied).length,
        negative: reviews.filter((r) => r.rating <= 2).length,
      };
      return NextResponse.json({ success: true, data: { reviews, stats } });
    }

    if (action === "posts") {
      const posts = await prisma.googlePost.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
      return NextResponse.json({ success: true, data: posts });
    }

    if (action === "insights") {
      if (!primaryId) return NextResponse.json({ success: false, message: "Chưa kết nối Google" }, { status: 400 });
      const { token, account } = await getValidToken(primaryId);
      if (!account.locationId) return NextResponse.json({ success: false, message: "Chưa chọn location" }, { status: 400 });
      const insights = await fetchGbpInsights(account.locationId, token);
      return NextResponse.json({ success: true, data: insights });
    }

    // Default: summary
    const account = await prisma.googleAccount.findFirst({ where: { isActive: true } });
    const reviewStats = await prisma.googleReview.aggregate({
      _count: { id: true },
      _avg: { rating: true },
    });
    const unreplied = await prisma.googleReview.count({ where: { isReplied: false } });
    return NextResponse.json({
      success: true,
      data: { account, reviewCount: reviewStats._count.id, avgRating: reviewStats._avg.rating ?? 0, unreplied },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e), success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "sync-reviews") {
      const primaryId = await getPrimaryAccountId();
      if (!primaryId) return NextResponse.json({ success: false, message: "Chưa kết nối Google" }, { status: 400 });
      const { token, account } = await getValidToken(primaryId);
      if (!account.locationId) return NextResponse.json({ success: false, message: "Chưa chọn location" }, { status: 400 });

      const reviews = await listGbpReviews(account.locationId, token);
      let newCount = 0;

      for (const r of reviews) {
        const existing = await prisma.googleReview.findUnique({ where: { reviewId: r.reviewId } });
        const sentiment = r.ratingNum >= 4 ? "positive" : r.ratingNum === 3 ? "neutral" : "negative";

        if (!existing) {
          await prisma.googleReview.create({
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
              googleAccountId: primaryId,
              updateTime: new Date(r.updateTime),
              createdAt: new Date(r.createTime),
            },
          });
          newCount++;
        } else if (r.reviewReply && !existing.isReplied) {
          await prisma.googleReview.update({
            where: { id: existing.id },
            data: { reply: r.reviewReply.comment, isReplied: true, repliedAt: new Date(r.reviewReply.updateTime) },
          });
        }
      }

      return NextResponse.json({ success: true, data: { synced: reviews.length, new: newCount } });
    }

    if (action === "reply") {
      const { reviewDbId, reply } = body as { reviewDbId: string; reply: string };
      const dbReview = await prisma.googleReview.findUnique({ where: { id: reviewDbId } });
      if (!dbReview) return NextResponse.json({ success: false, message: "Review không tìm thấy" }, { status: 404 });

      const primaryId = await getPrimaryAccountId();
      if (!primaryId) return NextResponse.json({ success: false, message: "Chưa kết nối Google" }, { status: 400 });
      const { token } = await getValidToken(primaryId);

      await replyToGbpReview(dbReview.reviewId, reply, token);
      await prisma.googleReview.update({
        where: { id: reviewDbId },
        data: { reply, isReplied: true, repliedAt: new Date() },
      });

      return NextResponse.json({ success: true });
    }

    if (action === "delete-reply") {
      const { reviewDbId } = body;
      const dbReview = await prisma.googleReview.findUnique({ where: { id: reviewDbId } });
      if (!dbReview) return NextResponse.json({ success: false, message: "Review không tìm thấy" }, { status: 404 });

      const primaryId = await getPrimaryAccountId();
      if (!primaryId) return NextResponse.json({ success: false, message: "Chưa kết nối" }, { status: 400 });
      const { token } = await getValidToken(primaryId);

      await deleteGbpReviewReply(dbReview.reviewId, token);
      await prisma.googleReview.update({
        where: { id: reviewDbId },
        data: { reply: null, isReplied: false, repliedAt: null },
      });
      return NextResponse.json({ success: true });
    }

    if (action === "ai-reply") {
      const { reviewDbId } = body;
      const dbReview = await prisma.googleReview.findUnique({ where: { id: reviewDbId } });
      if (!dbReview) return NextResponse.json({ success: false, message: "Review không tìm thấy" }, { status: 404 });

      const brandKit = await prisma.brandKit.findFirst();
      const spaName = brandKit?.spaName ?? "Spa";

      const prompt = `Khách hàng ${dbReview.authorName} để lại đánh giá ${dbReview.rating} sao trên Google Maps cho ${spaName}:

"${dbReview.comment ?? "(Không có bình luận)"}"

Hãy viết phản hồi thay mặt ${spaName}:
- Cảm ơn khách hàng ${dbReview.rating >= 4 ? "vì đánh giá tích cực" : "vì phản hồi thành thật"}
- ${dbReview.rating <= 2 ? "Xin lỗi về trải nghiệm chưa tốt và cam kết cải thiện. Mời khách quay lại để trải nghiệm tốt hơn." : "Khuyến khích khách quay lại, giới thiệu 1 dịch vụ phù hợp."}
- Ngắn gọn, chân thành, 50-80 từ, không sáo rỗng, không lặp tên spa quá 2 lần
Chỉ trả về phản hồi, không giải thích.`;

      const reply = await generateChatCompletion(prompt, `Bạn là manager của ${spaName}, viết phản hồi Google Review chuyên nghiệp, ấm áp.`);
      return NextResponse.json({ success: true, data: { reply } });
    }

    if (action === "create-post") {
      const { summary, callToActionType, callToActionUrl, mediaUrl } = body;
      if (!summary) return NextResponse.json({ success: false, message: "Thiếu summary" }, { status: 400 });

      const primaryId = await getPrimaryAccountId();
      if (!primaryId) return NextResponse.json({ success: false, message: "Chưa kết nối Google" }, { status: 400 });
      const { token, account } = await getValidToken(primaryId);
      if (!account.locationId) return NextResponse.json({ success: false, message: "Chưa chọn location" }, { status: 400 });

      const googlePostId = await createGbpPost(account.locationId, { summary, callToActionType, callToActionUrl, mediaUrl }, token);

      const dbPost = await prisma.googlePost.create({
        data: {
          googlePostId,
          summary,
          callToAction: callToActionType ?? null,
          callToActionUrl: callToActionUrl ?? null,
          mediaUrl: mediaUrl ?? null,
          status: "published",
          publishedAt: new Date(),
          googleAccountId: primaryId,
        },
      });

      return NextResponse.json({ success: true, data: dbPost });
    }

    if (action === "set-location") {
      const { googleAccountDbId, locationId, locationName } = body;
      await prisma.googleAccount.update({
        where: { id: googleAccountDbId },
        data: { locationId, locationName },
      });
      return NextResponse.json({ success: true });
    }

    if (action === "disconnect") {
      const { id } = body;
      await prisma.googleAccount.delete({ where: { id } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, message: "Action không hợp lệ" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e), success: false }, { status: 500 });
  }
}
