import { notFound } from "next/navigation";
import { ROUTES_BY_ID } from "@/config/routes";
import { AccessError } from "@/lib/page-access";
import { resolveWorkspaceAccess } from "@/lib/workspace-access";
import { parseWorkspaceUrl, workspaceScopesForRoute } from "@/lib/workspace-url";
import { WorkspacePermissionState } from "./WorkspacePermissionState";
import { WorkspaceShell } from "./WorkspaceShell";

export interface WorkspacePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function WorkspacePage({
  routeId,
  searchParams,
}: WorkspacePageProps & { routeId: string }) {
  const route = ROUTES_BY_ID.get(routeId);
  if (!route || route.kind !== "workspace" || !route.views?.length || !route.defaultView) notFound();

  const params = await searchParams;
  const requestedView = typeof params.view === "string" ? params.view : route.defaultView;
  const currentView = route.views.find((view) => view.id === requestedView) ?? route.views[0];
  const effectiveScope = currentView.scope ?? route.scope;
  const allowedScopes = workspaceScopesForRoute(effectiveScope);
  const state = parseWorkspaceUrl(params, {
    views: route.views.map((view) => view.id),
    defaultView: route.defaultView,
    defaultScope: allowedScopes[0],
    allowedScopes,
  });

  let access: Awaited<ReturnType<typeof resolveWorkspaceAccess>> | undefined;
  let permissionMessage: string | undefined;

  try {
    access = await resolveWorkspaceAccess(route, state, effectiveScope);
  } catch (error) {
    if (error instanceof AccessError && error.status === 403) {
      permissionMessage = error.message;
    } else {
      throw error;
    }
  }

  if (permissionMessage) {
    return <WorkspacePermissionState route={route} message={permissionMessage} />;
  }

  if (!access) notFound();

  return <WorkspaceShell route={route} state={access.state} pages={access.pages} effectiveScope={effectiveScope} />;
}
