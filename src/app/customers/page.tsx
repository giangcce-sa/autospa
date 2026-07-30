import type { Metadata } from "next";
import { CustomerOverview } from "@/components/modules/customers/CustomerOverview";
import { ROUTES_BY_ID } from "@/config/routes";
import { getCustomerOverview } from "@/lib/customer-overview";
import { resolveWorkspaceAccess } from "@/lib/workspace-access";
import { parseWorkspaceUrl } from "@/lib/workspace-url";

export const metadata: Metadata = {
  title: "Khách hàng",
  description: "Theo dõi hội thoại, lịch hẹn và quan hệ khách hàng.",
};

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const route = ROUTES_BY_ID.get("customers-sales");
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
  const data = await getCustomerOverview({ pageIds, currentPageId: access.state.pageId });

  return <CustomerOverview data={data} access={access} />;
}
