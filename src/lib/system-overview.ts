import "server-only";

import { getAIRoomCounts } from "@/lib/ai-rooms";
import { getBrandAssetsOverview } from "@/lib/brand-assets-overview";
import { getBrandAssetsReadiness } from "@/lib/brand-assets-readiness";
import { requireUser } from "@/lib/page-access";
import { getSettingsOverview } from "@/lib/settings/overview";

export async function getSystemOverview() {
  const user = await requireUser();
  const [settings, brandAssets, aiRooms] = await Promise.all([
    getSettingsOverview(),
    getBrandAssetsOverview(user),
    getAIRoomCounts(),
  ]);

  const brandScores = brandAssets.pages.map(getBrandAssetsReadiness);
  const brandReadyChecks = brandScores.reduce((total, score) => total + score.complete, 0);
  const brandTotalChecks = brandScores.reduce((total, score) => total + score.total, 0);

  return {
    asOf: new Date().toISOString(),
    settings,
    brandAssets: {
      pageCount: brandAssets.pages.length,
      readyChecks: brandReadyChecks,
      totalChecks: brandTotalChecks,
      fullyReadyPages: brandScores.filter((score) => score.ready).length,
      brandItemCount: brandAssets.brandItemCount,
      learningInsightCount: brandAssets.learningInsightCount,
    },
    aiRooms,
  };
}

export type SystemOverviewData = Awaited<ReturnType<typeof getSystemOverview>>;
