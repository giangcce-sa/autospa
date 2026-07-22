import "server-only";

import { prisma } from "@/lib/db";
import { getAuthorizedPageIds, requireUser } from "@/lib/page-access";

export interface BrandAssetsPageReadiness {
  id: string;
  pageName: string;
  isActive: boolean;
  hasBrandKit: boolean;
  serviceCount: number;
  staffCount: number;
  consentedStaffCount: number;
  storyCount: number;
  approvedStyleSampleCount: number;
  hasStyleProfile: boolean;
}

export interface BrandAssetsOverviewData {
  canMutate: boolean;
  brandItemCount: number;
  brandUpdatedAt: Date | null;
  learningInsightCount: number;
  learningUpdatedAt: Date | null;
  pages: BrandAssetsPageReadiness[];
}

export async function getBrandAssetsOverview(): Promise<BrandAssetsOverviewData> {
  const user = await requireUser();
  const authorizedPageIds = await getAuthorizedPageIds(user);
  const pageWhere = {
    ...(authorizedPageIds ? { id: { in: authorizedPageIds } } : {}),
    ...(user.role === "owner" ? {} : { isActive: true }),
  };

  const [
    brandItemCount,
    latestBrand,
    learningInsightCount,
    latestLearning,
    pages,
  ] = await Promise.all([
    prisma.brandKnowledge.count(),
    prisma.brandKnowledge.findFirst({ orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
    prisma.learningInsight.count(),
    prisma.learningInsight.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    prisma.facebookPage.findMany({
      where: pageWhere,
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        pageName: true,
        isActive: true,
        brandKit: { select: { id: true } },
        styleProfile: { select: { id: true } },
        _count: {
          select: {
            services: { where: { active: true } },
            staffVisuals: { where: { isActive: true } },
            styleSamples: { where: { learningStatus: "approved" } },
          },
        },
      },
    }),
  ]);

  const pageIds = pages.map((page) => page.id);
  const [consentedStaff, stories] = pageIds.length
    ? await Promise.all([
        prisma.staffVisualProfile.groupBy({
          by: ["facebookPageId"],
          where: { facebookPageId: { in: pageIds }, isActive: true, consentStatus: "consented" },
          _count: { _all: true },
        }),
        prisma.spaStory.groupBy({
          by: ["facebookPageId"],
          where: { facebookPageId: { in: pageIds }, isActive: true },
          _count: { _all: true },
        }),
      ])
    : [[], []];

  const consentedByPage = new Map(consentedStaff.map((item) => [item.facebookPageId, item._count._all]));
  const storiesByPage = new Map(stories.map((item) => [item.facebookPageId, item._count._all]));

  return {
    canMutate: user.role === "owner",
    brandItemCount,
    brandUpdatedAt: latestBrand?.updatedAt ?? null,
    learningInsightCount,
    learningUpdatedAt: latestLearning?.createdAt ?? null,
    pages: pages.map((page) => ({
      id: page.id,
      pageName: page.pageName,
      isActive: page.isActive,
      hasBrandKit: Boolean(page.brandKit),
      serviceCount: page._count.services,
      staffCount: page._count.staffVisuals,
      consentedStaffCount: consentedByPage.get(page.id) ?? 0,
      storyCount: storiesByPage.get(page.id) ?? 0,
      approvedStyleSampleCount: page._count.styleSamples,
      hasStyleProfile: Boolean(page.styleProfile),
    })),
  };
}
