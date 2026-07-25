"use client";

import { useRouter } from "next/navigation";

export function useCustomerWorkspaceNavigation({
  path,
  view,
  scope,
  pageId,
}: {
  path: string;
  view: string;
  scope: "current" | "all" | "account";
  pageId?: string;
}) {
  const router = useRouter();

  const navigate = (changes: { id?: string; status?: string }) => {
    const params = new URLSearchParams({ view, scope });
    if (pageId) params.set("pageId", pageId);
    if (changes.id) params.set("id", changes.id);
    if (changes.status) params.set("status", changes.status);
    router.push(`${path}?${params.toString()}`, { scroll: false });
  };

  return {
    onRecordChange: (id?: string) => navigate({ id }),
    onFilterChange: (status?: string) => navigate({ status }),
    refresh: () => router.refresh(),
  };
}
