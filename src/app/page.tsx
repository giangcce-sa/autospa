import { notFound } from "next/navigation";
import { Dashboard, DashboardHeading } from "@/components/modules/dashboard/Dashboard";
import { WorkspacePermissionState } from "@/components/workspace/WorkspacePermissionState";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { ROUTES_BY_ID } from "@/config/routes";
import { AccessError, requireUser } from "@/lib/page-access";
import { getTodayData } from "@/lib/today";
import { resolveWorkspaceAccess } from "@/lib/workspace-access";
import { parseWorkspaceUrl, workspaceScopesForRoute } from "@/lib/workspace-url";

export interface TodayPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function Home({ searchParams }: TodayPageProps) {
  const route = ROUTES_BY_ID.get("today");
  if (!route) notFound();

  const allowedScopes = workspaceScopesForRoute(route.scope);
  const state = parseWorkspaceUrl(await searchParams, {
    views: ["overview", "queue", "calendar"],
    defaultView: "overview",
    defaultScope: allowedScopes[0],
    allowedScopes,
  });

  let access: Awaited<ReturnType<typeof resolveWorkspaceAccess>> | undefined;
  let permissionMessage: string | undefined;
  let userName: string | null | undefined;
  try {
    const user = await requireUser();
    userName = user.name ?? user.email;
    access = await resolveWorkspaceAccess(route, state);
  } catch (error) {
    if (error instanceof AccessError && error.status === 403) permissionMessage = error.message;
    else throw error;
  }

  if (permissionMessage) return <WorkspacePermissionState route={route} message={permissionMessage} />;
  if (!access) notFound();

  const pageIds = access.state.scope === "current"
    ? access.state.pageId ? [access.state.pageId] : []
    : access.pages.map((page) => page.id);
  const data = await getTodayData({
    scope: access.state.scope,
    pageIds,
    // Hôm nay is the "everything I must act on today" view, so account-level
    // signals (approvals, alerts, ad actions, AI runs) stay visible to an owner
    // even while a single Page is selected — page scope still filters
    // page-owned records. Viewers never see account-wide data.
    includeGlobal: access.canMutate,
    canMutate: access.canMutate,
  });

  return (
    <WorkspaceShell
      route={route}
      state={access.state}
      pages={access.pages}
      wide
      dashboard
      header={<DashboardHeading data={data} userName={userName} />}
    >
      <Dashboard data={data} />
    </WorkspaceShell>
  );
}
