import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle, ClockCounterClockwise, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { AdsInsights } from "@/components/modules/facebook-ads/AdsInsights";
import { CampaignList } from "@/components/modules/facebook-ads/CampaignList";
import { CreateAd } from "@/components/modules/facebook-ads/CreateAd";
import { WorkspacePermissionState } from "@/components/workspace/WorkspacePermissionState";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { ROUTES_BY_ID } from "@/config/routes";
import {
  getAdsCampaignData,
  getAdsDraftPosts,
  getAdsInsightsData,
  getAdsOperations,
  getAdsWorkspaceContext,
  type AdsOperationData,
  type AdsWorkspaceContextData,
} from "@/lib/growth-ads";
import { AccessError } from "@/lib/page-access";
import { resolveWorkspaceAccess } from "@/lib/workspace-access";
import { parseWorkspaceUrl, workspaceScopesForRoute } from "@/lib/workspace-url";

export interface GrowthAdsWorkspaceProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const DATE_PRESETS = new Set(["today", "last_7d", "last_30d", "this_month"]);

export async function GrowthAdsWorkspace({ searchParams }: GrowthAdsWorkspaceProps) {
  const route = ROUTES_BY_ID.get("growth-ads");
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

  let access: Awaited<ReturnType<typeof resolveWorkspaceAccess>>;
  try {
    access = await resolveWorkspaceAccess(route, state, effectiveScope);
  } catch (error) {
    if (error instanceof AccessError && error.status === 403) {
      return <WorkspacePermissionState route={route} message={error.message} />;
    }
    throw error;
  }

  return (
    <WorkspaceShell route={route} state={access.state} pages={access.pages} effectiveScope={effectiveScope}>
      {access.state.pageId ? (
        <AdsWorkspaceContent
          view={currentView.id}
          facebookPageId={access.state.pageId}
          recordId={access.state.id}
          datePreset={typeof params.status === "string" && DATE_PRESETS.has(params.status) ? params.status : "last_7d"}
          canMutate={access.canMutate}
        />
      ) : null}
    </WorkspaceShell>
  );
}

async function AdsWorkspaceContent({
  view,
  facebookPageId,
  recordId,
  datePreset,
  canMutate,
}: {
  view: string;
  facebookPageId: string;
  recordId?: string;
  datePreset: string;
  canMutate: boolean;
}) {
  const context = await getAdsWorkspaceContext(facebookPageId);

  if (view === "create") {
    const posts = await getAdsDraftPosts(facebookPageId);
    return (
      <AdsWorkspaceFrame context={context}>
        {context.policy.writeBlocker ? <AdsBlocker context={context} /> : null}
        <CreateAd
          facebookPageId={facebookPageId}
          initialPostId={recordId}
          initialPosts={posts}
          canMutate={canMutate && !context.policy.writeBlocker}
        />
      </AdsWorkspaceFrame>
    );
  }

  if (view === "insights") {
    const insights = await getAdsInsightsData(facebookPageId, datePreset);
    return (
      <AdsWorkspaceFrame context={context}>
        <DataProvenance source={insights.source} window={insights.window} asOf={insights.asOf} availability={insights.availability} warning={insights.warning} />
        <AdsInsights
          facebookPageId={facebookPageId}
          initialData={insights.value}
          initialError={insights.warning}
          initialDatePreset={datePreset}
          canonical
        />
      </AdsWorkspaceFrame>
    );
  }

  if (view === "operations") {
    const operations = await getAdsOperations(facebookPageId);
    return (
      <AdsWorkspaceFrame context={context}>
        <AdsOperations operations={operations} />
      </AdsWorkspaceFrame>
    );
  }

  if (view === "overview") {
    const [insights, operations] = await Promise.all([
      getAdsInsightsData(facebookPageId, "last_7d"),
      getAdsOperations(facebookPageId),
    ]);
    return (
      <AdsWorkspaceFrame context={context}>
        {context.policy.writeBlocker ? <AdsBlocker context={context} /> : null}
        <DataProvenance source={insights.source} window={insights.window} asOf={insights.asOf} availability={insights.availability} warning={insights.warning} />
        <AdsInsights
          facebookPageId={facebookPageId}
          initialData={insights.value}
          initialError={insights.warning}
          canonical
        />
        <AdsOperations operations={operations.slice(0, 5)} compact />
      </AdsWorkspaceFrame>
    );
  }

  const campaigns = await getAdsCampaignData(facebookPageId);
  return (
    <AdsWorkspaceFrame context={context}>
      <DataProvenance source={campaigns.source} window={campaigns.window} asOf={campaigns.asOf} availability={campaigns.availability} warning={campaigns.warning} />
      <CampaignList
        facebookPageId={facebookPageId}
        initialCampaigns={campaigns.value ?? []}
        initialError={campaigns.warning}
        canMutate={canMutate && !context.policy.writeBlocker}
        canonical
      />
    </AdsWorkspaceFrame>
  );
}

function AdsWorkspaceFrame({ context, children }: { context: AdsWorkspaceContextData; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="grid gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4 sm:grid-cols-2 lg:grid-cols-4">
        <ContextItem label="Facebook Page" value={context.page.pageName} />
        <ContextItem label="Ad Account" value={context.page.adAccountId ?? "Chưa cấu hình"} />
        <ContextItem label="Execution mode" value={context.policy.executionMode} />
        <ContextItem label="Readiness" value={context.readiness.blocker ? "Bị khóa" : "Sẵn sàng"} danger={Boolean(context.readiness.blocker)} />
        <ContextItem label="Currency" value={context.readiness.currency ?? "Chưa xác minh"} />
        <ContextItem label="Account status" value={context.readiness.accountStatus == null ? "Chưa xác minh" : String(context.readiness.accountStatus)} />
        <ContextItem label="Readiness lúc" value={context.readiness.checkedAt ? new Date(context.readiness.checkedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "Chưa kiểm tra"} />
        <ContextItem label="Automation hiệu lực" value={context.policy.effectiveAutomationLevel} />
      </div>
      {children}
    </section>
  );
}

function ContextItem({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
      <p className={`mt-1 text-sm font-bold ${danger ? "text-[var(--danger)]" : "text-[var(--text)]"}`}>{value}</p>
    </div>
  );
}

function AdsBlocker({ context }: { context: AdsWorkspaceContextData }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-[var(--warning)] bg-[var(--bg-subtle)] p-4">
      <div className="flex gap-3">
        <WarningCircle size={20} className="mt-0.5 shrink-0 text-[var(--warning)]" aria-hidden="true" />
        <div>
          <h2 className="text-sm font-bold">Ads write đang bị khóa</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{context.policy.writeBlocker}</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Resource mới luôn được tạo ở trạng thái PAUSED; activation là hành động riêng.</p>
        </div>
      </div>
      <Link href="/system/settings?view=ads&scope=account" className="inline-flex min-h-11 shrink-0 items-center rounded-md bg-[var(--accent)] px-4 text-xs font-semibold text-[var(--accent-foreground)]">
        Mở Ads Settings
      </Link>
    </div>
  );
}

function DataProvenance({ source, window, asOf, availability, warning }: { source: string; window: string; asOf: string; availability: string; warning?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] p-4 text-sm">
      {availability === "available" ? <CheckCircle size={18} weight="fill" className="mt-0.5 shrink-0 text-[var(--success)]" /> : <WarningCircle size={18} className="mt-0.5 shrink-0 text-[var(--warning)]" />}
      <div>
        <p className="font-semibold text-[var(--text)]">{availability === "available" ? "Dữ liệu khả dụng" : "Dữ liệu chưa khả dụng"}</p>
        <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">Nguồn: {source} · cửa sổ: {window} · cập nhật: {new Date(asOf).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</p>
        {warning ? <p className="mt-1 text-xs text-[var(--warning)]">{warning}</p> : null}
      </div>
    </div>
  );
}

function AdsOperations({ operations, compact = false }: { operations: AdsOperationData[]; compact?: boolean }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-card)]">
      <div className="flex items-center gap-2 border-b border-[var(--border)] p-4">
        <ClockCounterClockwise size={17} className="text-[var(--accent)]" aria-hidden="true" />
        <h2 className="text-sm font-bold">{compact ? "Vận hành gần đây" : "Checkpoint và recovery"}</h2>
      </div>
      {operations.length ? operations.map((operation) => (
        <article key={operation.id} className="grid gap-2 border-b border-[var(--border)] p-4 last:border-b-0 sm:grid-cols-[1fr_auto]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-semibold text-[var(--text)]">{operation.id}</span>
              <span className="rounded-full bg-[var(--bg-subtle)] px-2 py-1 text-[10px] font-semibold text-[var(--text-secondary)]">{operation.status}</span>
              <span className="text-xs text-[var(--text-muted)]">Bước: {operation.currentStep} · lần thử {operation.attempt}</span>
            </div>
            {operation.error ? <p className="mt-2 text-xs text-[var(--danger)]">{operation.error}</p> : null}
            {operation.campaignId ? <p className="mt-2 font-mono text-[10px] text-[var(--text-muted)]">Campaign {operation.campaignId} · Ad {operation.adId ?? "chưa tạo"}</p> : null}
          </div>
          <time className="text-xs text-[var(--text-muted)]">{new Date(operation.updatedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</time>
        </article>
      )) : <p className="p-8 text-center text-sm text-[var(--text-muted)]">Chưa có operation tạo quảng cáo.</p>}
    </div>
  );
}
