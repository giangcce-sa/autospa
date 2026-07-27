import { prisma } from "@/lib/db";
import { reviewContent } from "@/lib/reviewer";
import { AccessError, requirePageAccess, requireUser } from "@/lib/page-access";
import { routeErrorResponse } from "@/lib/api-response";
import { resolvePostPageId } from "@/lib/page-scope-policy";
import { briefWriteData } from "@/lib/post-brief-input";
import {
  executePublishOperation,
  latestPublishChannelAttempts,
  PublishConflictError,
} from "@/lib/publishing/service";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const postId = searchParams.get("postId");
    if (!postId) return NextResponse.json({ error: "Thiếu postId", success: false }, { status: 400 });
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        caption: true,
        hashtags: true,
        imageUrl: true,
        facebookPageId: true,
        postType: true,
        tone: true,
        platform: true,
        status: true,
        scheduledAt: true,
        createdAt: true,
        service: { select: { name: true } },
        publishOperations: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            error: true,
            completedAt: true,
            reconciliationAt: true,
            channelAttempts: {
              orderBy: [{ channel: "asc" }, { attempt: "desc" }],
              select: {
                channel: true,
                status: true,
                externalId: true,
                error: true,
                completedAt: true,
              },
            },
          },
        },
      },
    });
    if (!post) return NextResponse.json({ error: "Không tìm thấy bài", success: false }, { status: 404 });
    await requirePageAccess(post.facebookPageId);
    const publishOperations = post.publishOperations.map((operation) => ({
      ...operation,
      channelAttempts: latestPublishChannelAttempts(operation.channelAttempts),
    }));
    return NextResponse.json({ data: { ...post, publishOperations }, success: true });
  } catch (error) {
    return routeErrorResponse(error, "Lỗi khi tải bài");
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser({ owner: true });
    const body = await req.json();
    const {
      postId, action, scheduledAt, caption, hashtags, imageUrl,
      platform, tone, postType, facebookPageId, force,
      // Multi-platform targets
      publishToInstagram, publishToTikTok, idempotencyKey,
    } = body;


    if (action === "update" || action === "schedule" || action === "draft") {
      const post = postId ? await prisma.post.findUnique({ where: { id: postId } }) : null;
      if (postId && !post) return NextResponse.json({ error: "Không tìm thấy bài", success: false }, { status: 404 });
      const resolvedPageId = resolvePostPageId(post?.facebookPageId, facebookPageId);
      if (resolvedPageId === null) throw new AccessError("Bài viết thuộc Facebook Page khác", 403);
      if (!resolvedPageId) return NextResponse.json({ error: "Hãy chọn Facebook Page", success: false }, { status: 400 });
      await requirePageAccess(resolvedPageId);
      if (action === "update" && !post) {
        return NextResponse.json({ error: "Cập nhật yêu cầu bài viết đã lưu", success: false }, { status: 400 });
      }
      const resolvedPostType = action === "draft"
        ? postType ?? post?.postType ?? "service"
        : post?.postType ?? postType ?? "service";
      if (action === "schedule" && resolvedPostType === "video") {
        return NextResponse.json({ error: "Video phải được xuất bản từ Xưởng video sau khi QA và duyệt", success: false }, { status: 400 });
      }
      // Validated before any write; only the brief fields the client actually
      // sent come back, so a partial save never resets a stored value.
      const briefFields = briefWriteData(body);

      if (post) {
        const updated = await prisma.$transaction(async (tx) => {
          const result = await tx.post.update({
            where: { id: post.id },
            data: {
              ...(action === "update"
                ? {}
                : {
                    status: action === "schedule" ? "scheduled" : "draft",
                    scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
                  }),
              ...(caption !== undefined && { caption }),
              ...(hashtags !== undefined && { hashtags }),
              ...(imageUrl !== undefined && { imageUrl }),
              ...(postType !== undefined && { postType: resolvedPostType }),
              ...briefFields,
              ...(post.facebookPageId ? {} : { facebookPageId: resolvedPageId }),
            },
          });
          const reviewInputChanged = (caption !== undefined && caption !== post.caption)
            || (hashtags !== undefined && hashtags !== post.hashtags);
          if (reviewInputChanged) await tx.contentReview.deleteMany({ where: { postId: post.id } });
          return result;
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
          ...briefFields,
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
        return NextResponse.json({
          data: { id: reviewPostId },
          error: "REVIEW_BLOCKED",
          review,
          success: false,
        }, { status: 422 });
      }

      if (typeof idempotencyKey !== "string" || !idempotencyKey.trim()) {
        return NextResponse.json({ error: "Thiếu idempotency key", success: false }, { status: 400 });
      }
      const requestedChannels = [
        "facebook" as const,
        ...(publishToInstagram ? ["instagram" as const] : []),
        ...(publishToTikTok ? ["tiktok" as const] : []),
      ];
      const operation = await executePublishOperation({
        idempotencyKey: idempotencyKey.trim(),
        postId: reviewPostId,
        facebookPageId: resolvedPageId,
        source: "manual",
        actorId: user.id ?? null,
        caption: finalCaption,
        hashtags: finalHashtags,
        imageUrl: finalImageUrl,
        channels: requestedChannels,
      });
      const updated = await prisma.post.findUniqueOrThrow({ where: { id: reviewPostId } });
      const results = Object.fromEntries(
        operation.channelAttempts.map((attempt) => [
          attempt.channel,
          attempt.externalId ?? `${attempt.status}:${attempt.error ?? ""}`,
        ]),
      );
      const success = ["completed", "partial"].includes(operation.status);

      return NextResponse.json(
        {
          data: updated,
          operation,
          results,
          success,
          ...(operation.error && { error: operation.error }),
        },
        { status: operation.status === "failed" ? 502 : operation.status === "needs_reconciliation" ? 409 : 200 },
      );
    }

    return NextResponse.json({ error: "Action không hợp lệ", success: false }, { status: 400 });
  } catch (err) {
    if (err instanceof PublishConflictError) {
      return NextResponse.json({ error: err.message, success: false }, { status: err.status });
    }
    return routeErrorResponse(err, "Lỗi không xác định");
  }
}
