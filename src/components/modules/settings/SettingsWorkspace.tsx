import { notFound } from "next/navigation";
import { WorkspacePermissionState } from "@/components/workspace/WorkspacePermissionState";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { ROUTES_BY_ID } from "@/config/routes";
import { AccessError } from "@/lib/page-access";
import { getAdsSettings } from "@/lib/settings/ads";
import { getAutomationSettings } from "@/lib/settings/automation";
import { getChannelSettings } from "@/lib/settings/channels";
import { getConnectionSettings } from "@/lib/settings/connections";
import { getDataSettings } from "@/lib/settings/data";
import { getSettingsOverview } from "@/lib/settings/overview";
import { getImageSettings, getProviderSettings } from "@/lib/settings/providers";
import { getSecuritySettings } from "@/lib/settings/security";
import { getVideoSettings } from "@/lib/settings/video";
import { resolveWorkspaceAccess } from "@/lib/workspace-access";
import { parseWorkspaceUrl, workspaceScopesForRoute } from "@/lib/workspace-url";
import { AdsSettingsForm } from "./AdsSettingsForm";
import { AutomationSettingsForm } from "./AutomationSettingsForm";
import { ChannelSettingsView } from "./ChannelSettingsView";
import { ConnectionSettingsForm } from "./ConnectionSettingsForm";
import { DataSettingsForm } from "./DataSettingsForm";
import { ImageSettingsForm } from "./ImageSettingsForm";
import { ProviderSettingsForm } from "./ProviderSettingsForm";
import { SecuritySettingsView } from "./SecuritySettingsView";
import { SettingsOverview } from "./SettingsOverview";
import { VideoSettingsForm } from "./VideoSettingsForm";

export interface SettingsWorkspaceProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function SettingsWorkspace({ searchParams }: SettingsWorkspaceProps) {
  const route = ROUTES_BY_ID.get("system-settings");
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
    if (error instanceof AccessError && error.status === 403) permissionMessage = error.message;
    else throw error;
  }

  if (permissionMessage) return <WorkspacePermissionState route={route} message={permissionMessage} />;
  if (!access) notFound();

  const overview = currentView.id === "overview" ? await getSettingsOverview() : null;
  const adsSettings = currentView.id === "ads" ? await getAdsSettings() : null;
  const automationSettings = currentView.id === "automation" ? await getAutomationSettings() : null;
  const connectionSettings = currentView.id === "connections" ? await getConnectionSettings() : null;
  const channelSettings = currentView.id === "channels" ? await getChannelSettings() : null;
  const dataSettings = currentView.id === "data" ? await getDataSettings() : null;
  const providerSettings = currentView.id === "providers" ? await getProviderSettings() : null;
  const imageSettings = currentView.id === "images" ? await getImageSettings() : null;
  const videoSettings = currentView.id === "video" ? await getVideoSettings() : null;
  const securitySettings = currentView.id === "security" ? await getSecuritySettings() : null;

  return (
    <WorkspaceShell route={route} state={access.state} pages={access.pages} effectiveScope={effectiveScope} dashboard>
      {overview ? (
        <SettingsOverview data={overview} />
      ) : adsSettings ? (
        <AdsSettingsForm initialSettings={adsSettings} />
      ) : automationSettings ? (
        <AutomationSettingsForm initialSettings={automationSettings} />
      ) : connectionSettings ? (
        <ConnectionSettingsForm initialSettings={connectionSettings} />
      ) : channelSettings ? (
        <ChannelSettingsView initialSettings={channelSettings} />
      ) : dataSettings ? (
        <DataSettingsForm initialSettings={dataSettings} />
      ) : providerSettings ? (
        <ProviderSettingsForm initialSettings={providerSettings} />
      ) : imageSettings ? (
        <ImageSettingsForm initialSettings={imageSettings} />
      ) : videoSettings ? (
        <VideoSettingsForm initialSettings={videoSettings} />
      ) : securitySettings ? (
        <SecuritySettingsView data={securitySettings} />
      ) : undefined}
    </WorkspaceShell>
  );
}
