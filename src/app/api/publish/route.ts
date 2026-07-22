import { prisma } from "@/lib/db";
import { postToFacebook } from "@/lib/facebook";
import { postToInstagram } from "@/lib/instagram";
import { postPhotoToTikTok } from "@/lib/tiktok";
import { reviewContent } from "@/lib/reviewer";
import { AccessError, accessErrorResponse, requirePageAccess } from "@/lib/page-access";
import { getPublishStatus, resolvePostPageId } from "@/lib/page-scope-policy";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const postId = searchParams.get("postId");
    if (!postId) return NextResponse.json({ error: "Thiếu postId", success: false }, { status: 400 });
    const post = await prisma.post.findUnique({ where: { id: postId }, include: { service: { select: { name: true } } } });
    if (!post) return NextResponse.json({ error: "Không tìm thấy bài", success: false }, { status: 404 });
    await requirePageAccess(post.facebookPageId);
    return NextResponse.json({ data: post, success: true });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
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
      const post = postId ? await prisma.post.findUnique({ where: { id: postId } }) : null;
      if (postId && !post) return NextResponse.json({ error: "Không tìm thấy bài", success: false }, { status: 404 });
      const resolvedPageId = resolvePostPageId(post?.facebookPageId, facebookPageId);
      if (resolvedPageId === null) throw new AccessError("Bài viết thuộc Facebook Page khác", 403);
      if (!resolvedPageId) return NextResponse.json({ error: "Hãy chọn Facebook Page", success: false }, { status: 400 });
      await requirePageAccess(resolvedPageId);
      const resolvedPostType = action === "draft"
        ? postType ?? post?.postType ?? "service"
        : post?.postType ?? postType ?? "service";
      if (action === "schedule" && resolvedPostType === "video") {
        return NextResponse.json({ error: "Video phải được xuất bản từ Xưởng video sau khi QA và duyệt", success: false }, { status: 400 });
      }

      if (post) {
        const updated = await prisma.post.update({
          where: { id: post.id },
          data: {
            status: action === "schedule" ? "scheduled" : "draft",
            scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
            ...(caption !== undefined && { caption }),
            ...(hashtags !== undefined && { hashtags }),
            ...(imageUrl !== undefined && { imageUrl }),
            ...(postType !== undefined && { postType: resolvedPostType }),
            ...(post.facebookPageId ? {} : { facebookPageId: resolvedPageId }),
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
          facebookPageId: resolvedPageId,
        },
      });
      return NextResponse.json({ data: created, success: true });
    }

    if (action === "publish-now") {
      const post = postId ? await prisma.post.findUnique({ where: { id: postId } }) : null;
      if (postId && !post) return NextResponse.json({ error: "Không tìm thấy bài", success: false }, { status: 404 });
      const resolvedPageId = resolvePostPageId(post?.facebookPageId, facebookPageId);
      if (resolvedPageId === null) throw new AccessError("Bài viết thuộc Facebook Page khác", 403);
      if (!resolvedPageId) return NextResponse.json({ error: "Hãy chọn Facebook Page", success: false }, { status: 400 });
      await requirePageAccess(resolvedPageId);
      const finalPostType = post?.postType ?? postType ?? "service";
      if (finalPostType === "video") {
        return NextResponse.json({ error: "Video phải được xuất bản từ Xưởng video sau khi QA và duyệt", success: false }, { status: 400 });
      }

      const finalCaption = caption ?? post?.caption ?? "";
      const finalHashtags = hashtags ?? post?.hashtags ?? null;
      const finalImageUrl = imageUrl !== undefined ? imageUrl : post?.imageUrl ?? null;
      const finalPlatform = platform ?? post?.platform ?? "facebook";
      const text = `${finalCaption}\n\n${finalHashtags ?? ""}`.trim();
      if (!text) return NextResponse.json({ error: "Nội dung bài viết đang trống", success: false }, { status: 400 });

      let reviewPostId = post?.id;
      if (!reviewPostId) {
        const draft = await prisma.post.create({
          data: {
            caption: finalCaption,
            hashtags: finalHashtags,
            imageUrl: finalImageUrl,
            platform: finalPlatform,
            tone: tone ?? "friendly",
            postType: postType ?? "service",
            facebookPageId: resolvedPageId,
          },
        });
        reviewPostId = draft.id;
      } else {
        await prisma.post.update({
          where: { id: reviewPostId },
          data: {
            caption: finalCaption,
            hashtags: finalHashtags,
            imageUrl: finalImageUrl,
            ...(post?.facebookPageId ? {} : { facebookPageId: resolvedPageId }),
          },
        });
      }

      const review = await reviewContent({
        id: reviewPostId,
        caption: finalCaption,
        hashtags: finalHashtags,
        platform: finalPlatform,
        facebookPageId: resolvedPageId,
      }).catch(() => null);
      if (review?.status === "fail" && !force) {
        return NextResponse.json({ error: "REVIEW_BLOCKED", review, success: false }, { status: 422 });
      }

      const results: Record<string, string | null> = { facebook: null, instagram: null, tiktok: null };
      try {
        results.facebook = await postToFacebook(text, finalImageUrl ?? undefined, resolvedPageId);
      } catch (e) {
        results.facebook = `error:${e instanceof Error ? e.message : String(e)}`;
      }

      if (publishToInstagram) {
        if (!finalImageUrl) {
          results.instagram = "error:Instagram yêu cầu hình ảnh";
        } else {
          try {
            const fbPage = await prisma.facebookPage.findUnique({ where: { id: resolvedPageId } });
            if (fbPage?.igAccountId) {
              results.instagram = await postToInstagram(fbPage.igAccountId, fbPage.accessToken, text, finalImageUrl);
            } else {
              results.instagram = "error:Chưa kết nối Instagram";
            }
          } catch (e) {
            results.instagram = `error:${e instanceof Error ? e.message : String(e)}`;
          }
        }
      }

      if (publishToTikTok) {
        if (!finalImageUrl) {
          results.tiktok = "error:TikTok yêu cầu hình ảnh";
        } else {
          try {
            const tiktokAccount = await prisma.tikTokAccount.findFirst({ where: { isActive: true } });
            if (tiktokAccount) {
              const { publishId } = await postPhotoToTikTok(tiktokAccount.accessToken, tiktokAccount.openId, text, [finalImageUrl]);
              results.tiktok = publishId;
            } else {
              results.tiktok = "error:Chưa kết nối TikTok";
            }
          } catch (e) {
            results.tiktok = `error:${e instanceof Error ? e.message : String(e)}`;
          }
        }
      }

      const requestedChannels = ["facebook", ...(publishToInstagram ? ["instagram"] : []), ...(publishToTikTok ? ["tiktok"] : [])];
      const status = getPublishStatus(results, requestedChannels);
      const facebookError = results.facebook?.startsWith("error:")
        ? results.facebook.slice("error:".length).trim()
        : null;
      const fbPostId = facebookError ? undefined : results.facebook ?? undefined;
      const igPostId = results.instagram?.startsWith("error:") ? undefined : results.instagram ?? undefined;
      const tiktokVideoId = results.tiktok?.startsWith("error:") ? undefined : results.tiktok ?? undefined;
      const updated = await prisma.post.update({
        where: { id: reviewPostId },
        data: {
          status,
          publishedAt: fbPostId ? new Date() : null,
          fbPostId,
          ...(igPostId && { igPostId }),
          ...(tiktokVideoId && { tiktokVideoId }),
        },
      });

      return NextResponse.json(
        {
          data: updated,
          results,
          success: status !== "publish_failed",
          ...(facebookError && { error: facebookError }),
        },
        { status: status === "publish_failed" ? 502 : 200 },
      );
    }

    return NextResponse.json({ error: "Action không hợp lệ", success: false }, { status: 400 });
  } catch (err) {
    const access = accessErrorResponse(err);
    if (access) return access;
    const msg = err instanceof Error ? err.message : "Lỗi không xác định";
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}
