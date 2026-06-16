import { prisma } from "@/lib/db";
import { postToFacebook } from "@/lib/facebook";
import { postToInstagram } from "@/lib/instagram";
import { postPhotoToTikTok } from "@/lib/tiktok";
import { reviewContent } from "@/lib/reviewer";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const postId = searchParams.get("postId");
    if (!postId) return NextResponse.json({ error: "Thiếu postId", success: false }, { status: 400 });
    const post = await prisma.post.findUnique({ where: { id: postId }, include: { service: { select: { name: true } } } });
    if (!post) return NextResponse.json({ error: "Không tìm thấy bài", success: false }, { status: 404 });
    return NextResponse.json({ data: post, success: true });
  } catch {
    return NextResponse.json({ error: "Lỗi khi tải bài", success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      postId, action, scheduledAt, caption, hashtags, imageUrl,
      platform, tone, postType, facebookPageId, force,
      // Multi-platform targets
      publishToInstagram, publishToTikTok,
    } = body;

    if (action === "schedule" || action === "draft") {
      if (postId) {
        const updated = await prisma.post.update({
          where: { id: postId },
          data: {
            status: action === "schedule" ? "scheduled" : "draft",
            scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
            ...(caption !== undefined && { caption }),
            ...(hashtags !== undefined && { hashtags }),
            ...(imageUrl !== undefined && { imageUrl }),
          },
        });
        return NextResponse.json({ data: updated, success: true });
      }

      const created = await prisma.post.create({
        data: {
          caption: caption ?? "",
          hashtags,
          imageUrl,
          platform: platform ?? "facebook",
          tone: tone ?? "friendly",
          postType: postType ?? "service",
          status: action === "schedule" ? "scheduled" : "draft",
          scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        },
      });
      return NextResponse.json({ data: created, success: true });
    }

    if (action === "publish-now") {
      const post = postId ? await prisma.post.findUnique({ where: { id: postId } }) : null;
      const text = post ? `${post.caption}\n\n${post.hashtags ?? ""}`.trim() : `${caption}\n\n${hashtags ?? ""}`.trim();
      const img = post?.imageUrl ?? imageUrl;

      // Reviewer gate
      const reviewInput = post
        ? { id: post.id, caption: post.caption, hashtags: post.hashtags, platform: post.platform, facebookPageId: post.facebookPageId }
        : null;

      if (reviewInput) {
        const review = await reviewContent(reviewInput).catch(() => null);
        if (review && review.status === "fail" && !force) {
          return NextResponse.json({ error: "REVIEW_BLOCKED", review, success: false }, { status: 422 });
        }
      }

      const results: Record<string, string | null> = { facebook: null, instagram: null, tiktok: null };

      // ── Facebook (always)
      try {
        results.facebook = await postToFacebook(text, img ?? undefined, facebookPageId ?? undefined);
      } catch (e) {
        results.facebook = `error:${e instanceof Error ? e.message : String(e)}`;
      }

      // ── Instagram (optional, requires igAccountId on page)
      if (publishToInstagram && img) {
        try {
          const fbPage = facebookPageId
            ? await prisma.facebookPage.findUnique({ where: { id: facebookPageId } })
            : await prisma.facebookPage.findFirst({ where: { isActive: true, igAccountId: { not: null } } });

          if (fbPage?.igAccountId) {
            results.instagram = await postToInstagram(fbPage.igAccountId, fbPage.accessToken, text, img);
          } else {
            results.instagram = "error:Chưa kết nối Instagram";
          }
        } catch (e) {
          results.instagram = `error:${e instanceof Error ? e.message : String(e)}`;
        }
      }

      // ── TikTok (optional, requires image URL)
      if (publishToTikTok && img) {
        try {
          const tiktokAccount = await prisma.tikTokAccount.findFirst({ where: { isActive: true } });
          if (tiktokAccount) {
            const { publishId } = await postPhotoToTikTok(tiktokAccount.accessToken, tiktokAccount.openId, text, [img]);
            results.tiktok = publishId;
          } else {
            results.tiktok = "error:Chưa kết nối TikTok";
          }
        } catch (e) {
          results.tiktok = `error:${e instanceof Error ? e.message : String(e)}`;
        }
      }

      const fbPostId = results.facebook?.startsWith("error:") ? undefined : results.facebook ?? undefined;
      const igPostId = results.instagram?.startsWith("error:") ? undefined : results.instagram ?? undefined;
      const tiktokVideoId = results.tiktok?.startsWith("error:") ? undefined : results.tiktok ?? undefined;

      const updated = await prisma.post.upsert({
        where: { id: postId ?? "new" },
        create: {
          caption: caption ?? "",
          hashtags, imageUrl,
          platform: platform ?? "facebook",
          tone: "friendly",
          postType: "service",
          status: "published",
          publishedAt: new Date(),
          fbPostId,
          igPostId,
          tiktokVideoId,
          facebookPageId: facebookPageId ?? null,
        },
        update: {
          status: "published",
          publishedAt: new Date(),
          fbPostId,
          ...(igPostId && { igPostId }),
          ...(tiktokVideoId && { tiktokVideoId }),
          facebookPageId: facebookPageId ?? null,
        },
      });

      return NextResponse.json({ data: updated, results, success: true });
    }

    return NextResponse.json({ error: "Action không hợp lệ", success: false }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi không xác định";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}
