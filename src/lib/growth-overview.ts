import "server-only";

import { prisma } from "@/lib/db";
import { getPromotionCapacity } from "@/lib/growth-promotions";
import { getIntelligencePerformance, type IntelligenceScope } from "@/lib/growth-intelligence";

export async function getGrowthOverview(pageIds: string[], scope: IntelligenceScope) {
  const asOf = new Date().toISOString();
  const pageFilter = { facebookPageId: { in: pageIds } };
  const [performance, pages, adsOperations, promotions, capacity, market] = await Promise.all([
    getIntelligencePerformance(pageIds, scope),
    prisma.facebookPage.findMany({
      where: { id: { in: pageIds } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        pageName: true,
        adAccountId: true,
        adsReadinessStatus: true,
        adsReadinessError: true,
        adsReadinessCheckedAt: true,
      },
    }),
    prisma.adsCreateOperation.findMany({
      where: pageFilter,
      orderBy: { updatedAt: "desc" },
      take: 12,
      select: {
        id: true,
        facebookPageId: true,
        status: true,
        currentStep: true,
        campaignId: true,
        error: true,
        updatedAt: true,
      },
    }),
    prisma.post.findMany({
      where: { ...pageFilter, postType: "promotion" },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        facebookPageId: true,
        caption: true,
        status: true,
        scheduledAt: true,
        publishedAt: true,
        createdAt: true,
        facebookPage: { select: { pageName: true } },
      },
    }),
    getPromotionCapacity(),
    Promise.all([
      prisma.competitor.count({ where: { isActive: true } }),
      prisma.competitorPost.count({ where: { publishedAt: { gte: new Date(Date.now() - 7 * 86_400_000) } } }),
      prisma.socialAlert.count({ where: { isRead: false } }),
      prisma.socialAlert.count({ where: { isRead: false, severity: { in: ["critical", "high"] } } }),
    ]),
  ]);

  const pageNames = new Map(pages.map((page) => [page.id, page.pageName]));
  const readyPages = pages.filter((page) => page.adAccountId && page.adsReadinessStatus === "ready" && !page.adsReadinessError).length;
  const failedOperations = adsOperations.filter((operation) => operation.status === "failed").length;
  const activePromotions = promotions.filter((post) => post.status === "scheduled" || post.status === "published").length;
  const [activeCompetitors, competitorPosts, unreadAlerts, urgentAlerts] = market;

  return {
    asOf,
    scope,
    performance,
    ads: {
      availability: pages.length ? "available" as const : "unavailable" as const,
      source: "FacebookPage AdsReadiness + AdsCreateOperation",
      window: "Readiness gần nhất + 12 operation gần nhất",
      asOf: pages.reduce((latest, page) => {
        const value = page.adsReadinessCheckedAt?.getTime() ?? 0;
        return value > latest ? value : latest;
      }, 0) || Date.parse(asOf),
      pages: pages.map((page) => ({
        ...page,
        adsReadinessCheckedAt: page.adsReadinessCheckedAt?.toISOString() ?? null,
      })),
      readyPages,
      failedOperations,
      operations: adsOperations.map((operation) => ({
        ...operation,
        pageName: pageNames.get(operation.facebookPageId) ?? "Facebook Page",
        updatedAt: operation.updatedAt.toISOString(),
      })),
      warning: pages.length ? undefined : "Chưa có Facebook Page trong phạm vi để đánh giá Ads readiness.",
    },
    promotions: {
      availability: promotions.length ? "available" as const : "unavailable" as const,
      source: "Post(postType=promotion)",
      window: "12 draft, scheduled hoặc published gần nhất",
      asOf,
      total: promotions.length,
      active: activePromotions,
      posts: promotions.map((post) => ({
        ...post,
        pageName: post.facebookPage?.pageName ?? "Facebook Page",
        scheduledAt: post.scheduledAt?.toISOString() ?? null,
        publishedAt: post.publishedAt?.toISOString() ?? null,
        createdAt: post.createdAt.toISOString(),
      })),
      capacity,
      warning: promotions.length ? undefined : "Chưa có Post khuyến mãi persisted trong phạm vi đã chọn.",
    },
    market: {
      availability: activeCompetitors || unreadAlerts ? "available" as const : "unavailable" as const,
      source: "Competitor + CompetitorPost + SocialAlert",
      window: "Đối thủ active, bài 7 ngày và cảnh báo chưa đọc",
      asOf,
      activeCompetitors,
      competitorPosts,
      unreadAlerts,
      urgentAlerts,
      warning: activeCompetitors || unreadAlerts ? undefined : "Chưa có tín hiệu đối thủ hoặc cảnh báo persisted; không được diễn giải thành thị trường không có rủi ro.",
    },
  };
}

export type GrowthOverviewData = Awaited<ReturnType<typeof getGrowthOverview>>;
