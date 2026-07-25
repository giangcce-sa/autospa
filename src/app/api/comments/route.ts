import { generateContent } from "@/lib/claude";
import { prisma } from "@/lib/db";
import { fetchFbComments, replyToFbComment } from "@/lib/facebook";
import { AccessError, accessErrorResponse, requireExplicitPageAccess, requirePageAccess, requireUser } from "@/lib/page-access";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const pageIdSchema = z.string().trim().min(1);
const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add-rule"), facebookPageId: pageIdSchema, trigger: z.string().trim().min(1).max(200), reply: z.string().trim().min(1).max(2_000), isActive: z.boolean().optional() }),
  z.object({ action: z.literal("toggle-rule"), facebookPageId: pageIdSchema, ruleId: z.string().trim().min(1) }),
  z.object({ action: z.literal("delete-rule"), facebookPageId: pageIdSchema, ruleId: z.string().trim().min(1) }),
  z.object({ action: z.literal("simulate"), facebookPageId: pageIdSchema, postId: z.string().trim().min(1), authorName: z.string().trim().min(1).max(200), content: z.string().trim().min(1).max(5_000) }),
  z.object({ action: z.literal("ai-reply"), facebookPageId: pageIdSchema, commentId: z.string().trim().min(1) }),
  z.object({ action: z.literal("send-fb-reply"), facebookPageId: pageIdSchema, commentId: z.string().trim().min(1) }),
  z.object({ action: z.literal("sync-fb"), facebookPageId: pageIdSchema, postLimit: z.number().int().min(1).max(25).default(10) }),
]);

function sentimentFor(content: string) {
  const lower = content.toLowerCase();
  const negativeWords = ["tệ", "xấu", "kém", "thất vọng", "chán", "không tốt", "lừa đảo", "tức", "ghét"];
  const positiveWords = ["hay", "tốt", "tuyệt", "đẹp", "hài lòng", "thích", "ổn", "ngon", "chuyên nghiệp"];
  if (negativeWords.some((word) => lower.includes(word))) return "negative";
  if (positiveWords.some((word) => lower.includes(word))) return "positive";
  return "neutral";
}

async function requireStoredComment(commentId: string, requestedPageId: string) {
  const comment = await prisma.postComment.findUnique({
    where: { id: commentId },
    include: { post: { select: { caption: true, facebookPageId: true } } },
  });
  if (!comment) throw new AccessError("Không tìm thấy bình luận", 404);
  if (comment.facebookPageId && comment.post.facebookPageId && comment.facebookPageId !== comment.post.facebookPageId) {
    throw new AccessError("Bình luận có Page ownership không nhất quán", 409);
  }
  const storedPageId = comment.facebookPageId ?? comment.post.facebookPageId;
  if (!storedPageId) throw new AccessError("Bình luận chưa xác định được Facebook Page", 409);
  await requirePageAccess(storedPageId, { owner: true });
  if (storedPageId !== requestedPageId) throw new AccessError("Bình luận không thuộc Facebook Page đang chọn", 403);
  return comment;
}

async function requireStoredRule(ruleId: string, requestedPageId: string) {
  const rule = await prisma.commentRule.findUnique({ where: { id: ruleId } });
  if (!rule) throw new AccessError("Không tìm thấy quy tắc", 404);
  if (!rule.facebookPageId) throw new AccessError("Quy tắc chưa xác định được Facebook Page", 409);
  await requirePageAccess(rule.facebookPageId, { owner: true });
  if (rule.facebookPageId !== requestedPageId) throw new AccessError("Quy tắc không thuộc Facebook Page đang chọn", 403);
  return rule;
}

export async function GET(req: NextRequest) {
  try {
    const facebookPageId = new URL(req.url).searchParams.get("facebookPageId");
    const { page } = await requireExplicitPageAccess(facebookPageId);
    const pageId = page!.id;
    const commentWhere = {
      OR: [
        { facebookPageId: pageId },
        { facebookPageId: null, post: { facebookPageId: pageId } },
      ],
    };
    const [comments, rules, alertCount, posts] = await Promise.all([
      prisma.postComment.findMany({
        where: commentWhere,
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { post: { select: { caption: true } } },
      }),
      prisma.commentRule.findMany({ where: { facebookPageId: pageId }, orderBy: { createdAt: "desc" } }),
      prisma.postComment.count({ where: { ...commentWhere, isAlert: true, isReplied: false } }),
      prisma.post.findMany({
        where: { facebookPageId: pageId },
        orderBy: { createdAt: "desc" },
        take: 25,
        select: { id: true, caption: true },
      }),
    ]);
    return NextResponse.json({ data: { comments, rules, alertCount, posts }, success: true });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    return NextResponse.json({ error: "Không thể tải bình luận", success: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireUser({ owner: true });
    const body = requestSchema.parse(await req.json());

    if (body.action === "add-rule") {
      const { page } = await requireExplicitPageAccess(body.facebookPageId, { owner: true });
      const rule = await prisma.commentRule.create({
        data: { facebookPageId: page!.id, trigger: body.trigger, reply: body.reply, isActive: body.isActive ?? true },
      });
      return NextResponse.json({ data: rule, success: true });
    }

    if (body.action === "toggle-rule") {
      const rule = await requireStoredRule(body.ruleId, body.facebookPageId);
      await prisma.commentRule.update({ where: { id: rule.id }, data: { isActive: !rule.isActive } });
      return NextResponse.json({ success: true });
    }

    if (body.action === "delete-rule") {
      const rule = await requireStoredRule(body.ruleId, body.facebookPageId);
      await prisma.commentRule.delete({ where: { id: rule.id } });
      return NextResponse.json({ success: true });
    }

    if (body.action === "simulate") {
      const { page } = await requireExplicitPageAccess(body.facebookPageId, { owner: true });
      const pageId = page!.id;
      const [post, rules] = await Promise.all([
        prisma.post.findFirst({ where: { id: body.postId, facebookPageId: pageId }, select: { id: true } }),
        prisma.commentRule.findMany({ where: { facebookPageId: pageId, isActive: true } }),
      ]);
      if (!post) throw new AccessError("Bài viết không thuộc Facebook Page đang chọn", 403);
      const sentiment = sentimentFor(body.content);
      const lower = body.content.toLowerCase();
      const matchedRule = rules.find((rule) => lower.includes(rule.trigger.toLowerCase()));
      const autoReply = matchedRule?.reply
        ?? (lower.includes("giá") || lower.includes("bao nhiêu") || lower.includes("chi phí")
          ? "Cảm ơn bạn đã quan tâm! Vui lòng inbox hoặc gọi hotline để được tư vấn giá cụ thể nhé."
          : lower.includes("book") || lower.includes("đặt") || lower.includes("hẹn")
            ? "Bạn có thể inbox hoặc để lại SĐT để spa tư vấn và đặt lịch ngay cho bạn nhé!"
            : null);
      const comment = await prisma.postComment.create({
        data: {
          postId: post.id,
          facebookPageId: pageId,
          authorName: body.authorName,
          content: body.content,
          sentiment,
          autoReply,
          isReplied: Boolean(autoReply),
          isAlert: sentiment === "negative",
        },
      });
      return NextResponse.json({ data: comment, success: true });
    }

    if (body.action === "ai-reply") {
      const comment = await requireStoredComment(body.commentId, body.facebookPageId);
      const reply = await generateContent(
        `Bài đăng: "${comment.post.caption.slice(0, 200)}"\nBình luận của khách: "${comment.content}"\nHãy trả lời bình luận này một cách thân thiện, chuyên nghiệp, ngắn gọn (dưới 80 chữ), phù hợp với spa. Chỉ trả về nội dung phản hồi, không giải thích thêm.`,
        "Bạn là nhân viên chăm sóc khách hàng của spa, trả lời bình luận Facebook.",
      );
      await prisma.postComment.update({ where: { id: comment.id }, data: { autoReply: reply } });
      return NextResponse.json({ data: { reply }, success: true });
    }

    if (body.action === "send-fb-reply") {
      const comment = await requireStoredComment(body.commentId, body.facebookPageId);
      if (!comment.fbCommentId || !comment.autoReply) {
        return NextResponse.json({ error: "Thiếu fbCommentId hoặc nội dung trả lời", success: false }, { status: 400 });
      }
      const claim = await prisma.postComment.updateMany({ where: { id: comment.id, isReplied: false }, data: { isReplied: true } });
      if (claim.count === 0) {
        return NextResponse.json({ error: "Bình luận đã được gửi hoặc đang được xử lý", success: false }, { status: 409 });
      }
      try {
        await replyToFbComment(comment.fbCommentId, comment.autoReply, body.facebookPageId);
      } catch (error) {
        await prisma.postComment.updateMany({ where: { id: comment.id, isReplied: true }, data: { isReplied: false } });
        throw error;
      }
      return NextResponse.json({ success: true });
    }

    const { page } = await requireExplicitPageAccess(body.facebookPageId, { owner: true });
    const pageId = page!.id;
    const rules = await prisma.commentRule.findMany({ where: { facebookPageId: pageId, isActive: true } });
    const fbComments = await fetchFbComments(body.postLimit, pageId);
    let newCount = 0;

    for (const fbComment of fbComments) {
      const exists = await prisma.postComment.findUnique({ where: { fbCommentId: fbComment.fbCommentId } });
      if (exists) continue;
      let post = await prisma.post.findFirst({ where: { fbPostId: fbComment.fbPostId, facebookPageId: pageId } });
      if (!post) {
        post = await prisma.post.create({
          data: {
            caption: fbComment.postCaption || "Bài đăng từ Facebook",
            platform: "facebook",
            postType: "service",
            tone: "friendly",
            status: "published",
            fbPostId: fbComment.fbPostId,
            facebookPageId: pageId,
            publishedAt: new Date(fbComment.createdTime),
          },
        });
      }
      const lower = fbComment.content.toLowerCase();
      const matchedRule = rules.find((rule) => lower.includes(rule.trigger.toLowerCase()));
      const sentiment = sentimentFor(fbComment.content);
      await prisma.postComment.create({
        data: {
          postId: post.id,
          fbCommentId: fbComment.fbCommentId,
          facebookPageId: pageId,
          authorName: fbComment.authorName,
          content: fbComment.content,
          sentiment,
          autoReply: matchedRule?.reply ?? null,
          isReplied: false,
          isAlert: sentiment === "negative",
          createdAt: new Date(fbComment.createdTime),
        },
      });
      newCount++;
    }

    return NextResponse.json({ data: { newCount, total: fbComments.length }, success: true });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    const message = error instanceof Error ? error.message : "Không thể xử lý bình luận";
    return NextResponse.json({ error: message, success: false }, { status: error instanceof z.ZodError ? 400 : 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireUser({ owner: true });
    const { searchParams } = new URL(req.url);
    const id = z.string().trim().min(1).parse(searchParams.get("id"));
    const facebookPageId = pageIdSchema.parse(searchParams.get("facebookPageId"));
    const comment = await requireStoredComment(id, facebookPageId);
    await prisma.postComment.delete({ where: { id: comment.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const access = accessErrorResponse(error);
    if (access) return access;
    const message = error instanceof Error ? error.message : "Không thể xóa bình luận";
    return NextResponse.json({ error: message, success: false }, { status: error instanceof z.ZodError ? 400 : 500 });
  }
}
