import "server-only";

import { prisma } from "@/lib/db";

export async function getBulkPlans(facebookPageId: string) {
  const plans = await prisma.bulkPlan.findMany({
    where: { facebookPageId },
    include: {
      posts: {
        orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
        select: { id: true, status: true, scheduledAt: true, caption: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return plans.map((plan) => ({
    ...plan,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
    posts: plan.posts.map((post) => ({
      ...post,
      scheduledAt: post.scheduledAt?.toISOString() ?? null,
    })),
  }));
}

export type BulkPlanData = Awaited<ReturnType<typeof getBulkPlans>>[number];
