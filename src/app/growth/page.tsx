import type { Metadata } from "next";
import { GrowthOverview } from "@/components/modules/growth/GrowthOverview";
import { ROUTES_BY_ID } from "@/config/routes";
import { getGrowthOverview } from "@/lib/growth-overview";
import { resolveWorkspaceAccess } from "@/lib/workspace-access";
import { parseWorkspaceUrl } from "@/lib/workspace-url";

export const metadata: Metadata = {
  title: "Tăng trưởng",
  description: "Báo cáo, quảng cáo và công cụ phát triển hoạt động spa.",
};

export default async function GrowthPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const route = ROUTES_BY_ID.get("growth-intelligence");
  if (!route || route.kind !== "workspace") return null;
  const params = await searchParams;
  const state = parseWorkspaceUrl(params, {
    views: ["overview"],
    defaultView: "overview",
    defaultScope: "current",
    allowedScopes: ["current", "all"],
  });
  const access = await resolveWorkspaceAccess(route, state, "current_or_all");
  const pageIds = access.state.scope === "all"
    ? access.pages.map((page) => page.id)
    : access.state.pageId ? [access.state.pageId] : [];
  const data = await getGrowthOverview(pageIds, access.state.scope === "all" ? "all" : "current");

  return <GrowthOverview data={data} access={access} />;
}
