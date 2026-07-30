import { notFound } from "next/navigation";
import { BrandManager } from "@/components/modules/brand/BrandManager";
import { BrandKitManager } from "@/components/modules/brand-kit/BrandKitManager";
import { LearningDashboard } from "@/components/modules/learning/LearningDashboard";
import { ServicesManager } from "@/components/modules/services/ServicesManager";
import { StaffVisualLibrary } from "@/components/modules/staff-visuals/StaffVisualLibrary";
import { StoryManager } from "@/components/modules/stories/StoryManager";
import { StyleTraining } from "@/components/modules/style-training/StyleTraining";
import { WorkspacePermissionState } from "@/components/workspace/WorkspacePermissionState";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { ROUTES_BY_ID } from "@/config/routes";
import { getBrandAssetsOverview } from "@/lib/brand-assets-overview";
import { AccessError } from "@/lib/page-access";
import { resolveWorkspaceAccess } from "@/lib/workspace-access";
import { parseWorkspaceUrl, workspaceScopesForRoute } from "@/lib/workspace-url";
import { BrandAssetsOverview } from "./BrandAssetsOverview";

export interface BrandAssetsWorkspaceProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function BrandAssetsWorkspace({ searchParams }: BrandAssetsWorkspaceProps) {
  const route = ROUTES_BY_ID.get("system-brand-assets");
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

  if (permissionMessage) return <WorkspacePermissionState route={route} message={permissionMessage} />;
  if (!access) notFound();

  const page = access.pages.find((item) => item.id === access.state.pageId);
  const overview = currentView.id === "overview" ? await getBrandAssetsOverview() : undefined;

  return (
    <WorkspaceShell route={route} state={access.state} pages={access.pages} effectiveScope={effectiveScope} dashboard>
      {currentView.id === "overview" && overview ? <BrandAssetsOverview data={overview} /> : null}
      {currentView.id === "brand" ? <BrandManager canMutate={access.canMutate} /> : null}
      {currentView.id === "kit" && page ? <BrandKitManager facebookPageId={page.id} canMutate={access.canMutate} /> : null}
      {currentView.id === "services" && page ? <ServicesManager facebookPageId={page.id} canMutate={access.canMutate} /> : null}
      {currentView.id === "staff" && page ? <StaffVisualLibrary facebookPageId={page.id} canMutate={access.canMutate} /> : null}
      {currentView.id === "stories" && page ? <StoryManager facebookPageId={page.id} canMutate={access.canMutate} /> : null}
      {currentView.id === "style" && page ? (
        <StyleTraining facebookPageId={page.id} facebookPageName={page.pageName} canMutate={access.canMutate} />
      ) : null}
      {currentView.id === "learning" ? <LearningDashboard canMutate={access.canMutate} /> : null}
    </WorkspaceShell>
  );
}
