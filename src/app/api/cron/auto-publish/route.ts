import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyCronAuth } from "@/lib/cron-auth";
import { postToFacebook } from "@/lib/facebook";
import { postToZalo } from "@/lib/zalo";

export async function GET(req: NextRequest) {
  const denied = verifyCronAuth(req);
  if (denied) return denied;

  const now = new Date();
  const posts = await prisma.post.findMany({
    where: { status: "scheduled", scheduledAt: { lte: now } },
    take: 10,
    orderBy: { scheduledAt: "asc" },
  });

  let published = 0;
  let failed = 0;

  for (const post of posts) {
    const fullText = [post.caption, post.hashtags].filter(Boolean).join("\n\n");
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

  return NextResponse.json({ published, failed, checked: posts.length });
}
