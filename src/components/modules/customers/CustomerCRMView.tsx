"use client";

import { CRMManager } from "@/components/modules/crm/CRMManager";
import type { CustomerDetailData, CustomerStatsData, CustomerSummaryData } from "@/lib/customer-workspaces";
import { useCustomerWorkspaceNavigation } from "./CustomerWorkspaceNavigation";

export function CustomerCRMView({
  view,
  customers,
  stats,
  customer,
  canMutate,
  status,
}: {
  view: string;
  customers: CustomerSummaryData[];
  stats: CustomerStatsData;
  customer: CustomerDetailData | null;
  canMutate: boolean;
  status?: string;
}) {
  const navigation = useCustomerWorkspaceNavigation({
    path: "/customers/crm",
    view,
    scope: "account",
  });

  return (
    <CRMManager
      initialCustomers={customers}
      initialStats={stats}
      initialCustomer={customer}
      initialSegment={status}
      canMutate={canMutate}
      onCustomerChange={navigation.onRecordChange}
      onSegmentChange={navigation.onFilterChange}
      onMutate={navigation.refresh}
    />
  );
}
