import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyCronAuth } from "@/lib/cron-auth";
import { postToFacebook } from "@/lib/facebook";
import { postToZalo } from "@/lib/zalo";
import { reviewContent } from "@/lib/reviewer";

export async function GET(req: NextRequest) {
  const denied = verifyCronAuth(req);
  if (denied) return denied;

  const now = new Date();
  const posts = await prisma.post.findMany({
    where: { status: "scheduled", scheduledAt: { lte: now } },
    include: { review: true },
    take: 10,
    orderBy: { scheduledAt: "asc" },
  });

  let published = 0;
  let failed = 0;
  let blocked = 0;

  for (const post of posts) {
    const fullText = [post.caption, post.hashtags].filter(Boolean).join("\n\n");

    // Last line of defense: REVIEWER GATE
    // Nếu chưa review thì review luôn
    let reviewStatus: string | undefined = post.review?.status;
    let reviewIssuesRaw: string = post.review?.issues ?? "[]";
    if (!post.review) {
      const fresh = await reviewContent({
        id: post.id,
        caption: post.caption,
        hashtags: post.hashtags,
        platform: post.platform,
        facebookPageId: post.facebookPageId,
      }).catch(() => null);
      if (fresh) {
        reviewStatus = fresh.status;
        reviewIssuesRaw = JSON.stringify(fresh.issues);
      }
    }

    if (reviewStatus === "fail") {
      // Block đăng — đánh dấu draft + log lý do để admin xem
      let issuesText = "Reviewer blocked";
      try {
        const parsed = JSON.parse(reviewIssuesRaw) as Array<{ message: string; severity: string }>;
        const critical = parsed.filter((i) => i.severity === "critical" || i.severity === "high");
        if (critical.length > 0) {
          issuesText = critical.map((i) => i.message).join("; ").slice(0, 280);
        }
      } catch { /* ignore */ }

      await prisma.post.update({
        where: { id: post.id },
        data: {
          status: "draft",      // revert about về draft để admin sửa
          qualityNotes: `🚨 Auto-publish BLOCKED bởi Reviewer: ${issuesText}`,
        },
      });

      // Tạo realtime alert để admin biết ngay
      await prisma.realtimeAlert.create({
        data: {
          type: "review_blocked",
          signal: `Bài lên lịch bị chặn vì FB Policy: ${issuesText}`,
          severity: "warning",
        },
      }).catch(() => null);

      blocked++;
      continue;
    }

    try {
      if (post.platform === "zalo") {
        await postToZalo(fullText, post.imageUrl ?? undefined);
        await prisma.post.update({
          where: { id: post.id },
          data: { status: "published", publishedAt: now },
        });
      } else {
        const fbPostId = await postToFacebook(fullText, post.imageUrl ?? undefined, post.facebookPageId ?? undefined);
        await prisma.post.update({
          where: { id: post.id },
          data: { status: "published", publishedAt: now, fbPostId },
        });
      }
      published++;
    } catch (err) {
      failed++;
      await prisma.post.update({
        where: { id: post.id },
        data: { qualityNotes: `Auto-publish failed: ${err instanceof Error ? err.message : String(err)}` },
      });
    }
  }

  await prisma.spaSync.upsert({
    where: { id: "1" },
    update: { lastPublishRun: now },
    create: { id: "1", lastPublishRun: now },
  });

  return NextResponse.json({ published, failed, blocked, checked: posts.length });
}
