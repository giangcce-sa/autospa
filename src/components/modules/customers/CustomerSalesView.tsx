"use client";

import { SaleManager } from "@/components/modules/sale/SaleManager";
import type { LeadData, LeadStatsData } from "@/lib/customer-workspaces";
import { useCustomerWorkspaceNavigation } from "./CustomerWorkspaceNavigation";

export function CustomerSalesView({
  view,
  scope,
  pageId,
  leads,
  stats,
  canMutate,
  status,
}: {
  view: string;
  scope: "current" | "all";
  pageId?: string;
  leads: LeadData[];
  stats: LeadStatsData;
  canMutate: boolean;
  status?: string;
}) {
  const navigation = useCustomerWorkspaceNavigation({
    path: "/customers/sales",
    view,
    scope,
    pageId,
  });

  return (
    <SaleManager
      initialLeads={leads}
      initialStats={stats}
      initialStage={status}
      canMutate={canMutate}
      canonical
      onStageChange={navigation.onFilterChange}
      onMutate={navigation.refresh}
    />
  );
}
