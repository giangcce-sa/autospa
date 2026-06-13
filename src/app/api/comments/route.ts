import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateContent } from "@/lib/claude";
import { fetchFbComments, replyToFbComment } from "@/lib/facebook";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const facebookPageId = searchParams.get("facebookPageId") || undefined;
    const where = facebookPageId ? { facebookPageId } : {};
    const [comments, rules, alertCount] = await Promise.all([
      prisma.postComment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { post: { select: { caption: true } } },
      }),
      prisma.commentRule.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.postComment.count({ where: { ...where, isAlert: true, isReplied: false } }),
    ]);
    return NextResponse.json({ data: { comments, rules, alertCount } });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "add-rule") {
      const rule = await prisma.commentRule.create({
        data: { trigger: body.trigger, reply: body.reply, isActive: body.isActive ?? true },
      });
      return NextResponse.json({ data: rule });
    }

    if (action === "toggle-rule") {
      const rule = await prisma.commentRule.findUnique({ where: { id: body.ruleId } });
      if (!rule) return NextResponse.json({ error: "Not found" }, { status: 404 });
      await prisma.commentRule.update({ where: { id: body.ruleId }, data: { isActive: !rule.isActive } });
      return NextResponse.json({ success: true });
    }

    if (action === "delete-rule") {
      await prisma.commentRule.delete({ where: { id: body.ruleId } });
      return NextResponse.json({ success: true });
    }

    if (action === "simulate") {
      const { authorName, content, postId } = body;
      const rules = await prisma.commentRule.findMany({ where: { isActive: true } });

      let autoReply: string | null = null;
      let sentiment = "neutral";
      const lower = content.toLowerCase();

      const negativeWords = ["tệ", "xấu", "kém", "thất vọng", "chán", "không tốt", "lừa đảo", "tức", "ghét"];
      const positiveWords = ["hay", "tốt", "tuyệt", "đẹp", "hài lòng", "thích", "ổn", "ngon", "chuyên nghiệp"];
      if (negativeWords.some((w) => lower.includes(w))) sentiment = "negative";
      else if (positiveWords.some((w) => lower.includes(w))) sentiment = "positive";

      const matchedRule = rules.find((r: { trigger: string; reply: string }) => lower.includes(r.trigger.toLowerCase()));
      if (matchedRule) {
        autoReply = matchedRule.reply;
      } else if (lower.includes("giá") || lower.includes("bao nhiêu") || lower.includes("chi phí")) {
        autoReply = "Cảm ơn bạn đã quan tâm! Vui lòng inbox hoặc gọi hotline để được tư vấn giá cụ thể nhé 💚";
      } else if (lower.includes("book") || lower.includes("đặt") || lower.includes("hẹn")) {
        autoReply = "Bạn có thể inbox hoặc để lại SĐT để spa tư vấn và đặt lịch ngay cho bạn nhé! 🌿";
      }

      const post = await prisma.post.findFirst({ orderBy: { createdAt: "desc" } });
      const targetPostId = postId || post?.id;
      if (!targetPostId) return NextResponse.json({ error: "No posts found" }, { status: 400 });

      const comment = await prisma.postComment.create({
        data: { postId: targetPostId, authorName, content, sentiment, autoReply, isReplied: !!autoReply, isAlert: sentiment === "negative" },
      });
      return NextResponse.json({ data: comment });
    }

    if (action === "ai-reply") {
      const { commentId } = body;
      const comment = await prisma.postComment.findUnique({
        where: { id: commentId },
        include: { post: { select: { caption: true } } },
      });
      if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });

      const reply = await generateContent(
        `Bài đăng: "${comment.post.caption.slice(0, 200)}"\nBình luận của khách: "${comment.content}"\nHãy trả lời bình luận này một cách thân thiện, chuyên nghiệp, ngắn gọn (dưới 80 chữ), phù hợp với spa. Chỉ trả về nội dung phản hồi, không giải thích thêm.`,
        "Bạn là nhân viên chăm sóc khách hàng của spa, trả lời bình luận Facebook."
      );
      await prisma.postComment.update({ where: { id: commentId }, data: { autoReply: reply } });
      return NextResponse.json({ data: { reply } });
    }

    // Send AI reply to Facebook comment
    if (action === "send-fb-reply") {
      const { commentId } = body;
      const comment = await prisma.postComment.findUnique({ where: { id: commentId } });
      if (!comment?.fbCommentId || !comment.autoReply) {
        return NextResponse.json({ error: "Thiếu fbCommentId hoặc nội dung trả lời" }, { status: 400 });
      }
      await replyToFbComment(comment.fbCommentId, comment.autoReply, comment.facebookPageId ?? undefined);
      await prisma.postComment.update({ where: { id: commentId }, data: { isReplied: true } });
      return NextResponse.json({ success: true });
    }

    // Sync real comments from Facebook
    if (action === "sync-fb") {
      const rules = await prisma.commentRule.findMany({ where: { isActive: true } });
      const { facebookPageId } = body;

      // If specific page given, sync just that; otherwise sync all active pages
      const pagesToSync = facebookPageId
        ? await prisma.facebookPage.findMany({ where: { id: facebookPageId } })
        : await prisma.facebookPage.findMany({ where: { isActive: true } });

      if (!pagesToSync.length) return NextResponse.json({ error: "Chưa cấu hình Facebook Page", success: false }, { status: 400 });

      let newCount = 0;
      let total = 0;
      for (const page of pagesToSync) {
        let fbComments;
        try {
          fbComments = await fetchFbComments(body.postLimit ?? 10, page.id);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return NextResponse.json({ error: msg, success: false }, { status: 400 });
        }
        total += fbComments.length;

        for (const fc of fbComments) {
          const exists = await prisma.postComment.findFirst({ where: { fbCommentId: fc.fbCommentId } });
          if (exists) continue;

          let post = await prisma.post.findFirst({ where: { fbPostId: fc.fbPostId } });
          if (!post) {
            post = await prisma.post.create({
              data: {
                caption: fc.postCaption || "Bài đăng từ Facebook",
                platform: "facebook",
                postType: "service",
                tone: "friendly",
                status: "published",
                fbPostId: fc.fbPostId,
                facebookPageId: page.id,
                publishedAt: new Date(fc.createdTime),
              },
            });
          }

          const lower = fc.content.toLowerCase();
          const negW = ["tệ", "xấu", "kém", "thất vọng", "chán", "không tốt", "lừa đảo", "tức", "ghét"];
          const posW = ["hay", "tốt", "tuyệt", "đẹp", "hài lòng", "thích", "ổn", "ngon", "chuyên nghiệp"];
          let sentiment = "neutral";
          if (negW.some((w) => lower.includes(w))) sentiment = "negative";
          else if (posW.some((w) => lower.includes(w))) sentiment = "positive";

          const matchedRule = rules.find((r: { trigger: string; reply: string }) => lower.includes(r.trigger.toLowerCase()));
          const autoReply = matchedRule?.reply ?? null;

          await prisma.postComment.create({
            data: {
              postId: post.id,
              fbCommentId: fc.fbCommentId,
              facebookPageId: page.id,
              authorName: fc.authorName,
              content: fc.content,
              sentiment,
              autoReply,
              isReplied: false,
              isAlert: sentiment === "negative",
              createdAt: new Date(fc.createdTime),
            },
          });
          newCount++;
        }
      }

      return NextResponse.json({ data: { newCount, total }, success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (id) await prisma.postComment.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
