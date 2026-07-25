import { notFound } from "next/navigation";
import { Dashboard } from "@/components/modules/dashboard/Dashboard";
import { WorkspacePermissionState } from "@/components/workspace/WorkspacePermissionState";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { ROUTES_BY_ID } from "@/config/routes";
import { AccessError } from "@/lib/page-access";
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
  try {
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
    includeGlobal: access.state.scope === "all" && access.canMutate,
    canMutate: access.canMutate,
  });

  return (
    <WorkspaceShell route={route} state={access.state} pages={access.pages}>
      <Dashboard data={data} />
    </WorkspaceShell>
  );
}
