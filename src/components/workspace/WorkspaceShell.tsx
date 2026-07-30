import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle, Plugs, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import type { AppRoute, RouteScope, WorkspaceView } from "@/config/routes";
import { EmptyState } from "@/components/ui/EmptyState";
import { HorizontalScroller } from "@/components/ui/HorizontalScroller";
import { WorkspaceScopeControl } from "@/components/workspace/WorkspaceScopeControl";
import type { WorkspacePageOption } from "@/lib/workspace-access";
import { workspaceScopesForRoute, workspaceSearchParams, type WorkspaceUrlState } from "@/lib/workspace-url";

export function WorkspaceShell({
  route,
  state,
  pages,
  effectiveScope = route.scope,
  visibleViewIds,
  header,
  topNav,
  wide = false,
  dashboard = false,
  children,
}: {
  route: AppRoute;
  state: WorkspaceUrlState;
  pages: WorkspacePageOption[];
  effectiveScope?: RouteScope;
  visibleViewIds?: string[];
  /** Replaces the default eyebrow/title/description block (the page keeps its own h1). */
  header?: ReactNode;
  /** Section-level tab strip rendered above the workspace header. */
  topNav?: ReactNode;
  /** Command-center screens need the full content width instead of the reading-width default. */
  wide?: boolean;
  /** Uses the dense dashboard header and navigation treatment. */
  dashboard?: boolean;
  children?: ReactNode;
}) {
  const views = (route.views ?? []).filter((view) => !visibleViewIds || visibleViewIds.includes(view.id));
  const currentView = views.find((view) => view.id === state.view) ?? views[0];

  return (
    <div className={`space-y-5 ${wide || dashboard ? "max-w-none" : "max-w-6xl space-y-6"}`}>
      {topNav}
      <header className={dashboard ? "overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface-card)] shadow-[var(--shadow-sm)]" : wide ? "" : "border-b border-[var(--border)] pb-5"}>
        <div className={`flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:flex-wrap sm:items-start ${dashboard ? "p-5 lg:p-6" : ""}`}>
          {header ?? (
            <div>
              <p className={`${dashboard ? "text-[11px] font-extrabold uppercase tracking-[0.16em]" : "text-[13px] font-semibold"} text-[var(--accent)]`}>Phần mềm chức năng</p>
              <h1 className="mt-1 text-[30px] font-extrabold">{route.label}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">{route.description}</p>
            </div>
          )}
          <WorkspaceScopeControl routePath={route.path} state={state} pages={pages} effectiveScope={effectiveScope} />
        </div>
        <WorkspaceNav route={route} views={views} state={state} pages={pages} dashboard={dashboard} />
      </header>

      {effectiveScope !== "account" && !pages.length ? (
        <WorkspaceDisconnectedState route={route} />
      ) : children ?? (currentView?.targetPath ? (
        <WorkspaceHandoff view={currentView} state={state} />
      ) : (
        <WorkspaceOverview route={route} views={views} state={state} />
      ))}
    </div>
  );
}

function WorkspaceDisconnectedState({ route }: { route: AppRoute }) {
  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)]">
      <EmptyState
        icon={<Plugs size={24} aria-hidden="true" />}
        title="Chưa có Facebook Page khả dụng"
        description="Workspace này cần một Facebook Page đang hoạt động và được cấp quyền. Owner có thể cấu hình kết nối trong Cài đặt & Kết nối."
        action={route.ownerOnly ? undefined : (
          <Link
            href="/system/settings?view=channels&scope=account"
            className="inline-flex min-h-11 items-center rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-foreground)]"
          >
            Mở cài đặt kết nối
          </Link>
        )}
      />
    </section>
  );
}

function workspaceViewState(route: AppRoute, state: WorkspaceUrlState): WorkspaceUrlState {
  if (route.section !== "creative") return state;
  const recordViewsByRoute: Record<string, readonly string[]> = {
    "creative-ideas": ["overview"],
    "creative-content": ["editor", "review"],
    "creative-images": ["create"],
    "creative-video": ["projects", "review", "jobs"],
    "creative-publishing": ["composer"],
  };
  const libraryViews = new Set(["overview", "library"]);
  return {
    ...state,
    id: recordViewsByRoute[route.id]?.includes(state.view) ? state.id : undefined,
    step: route.id === "creative-video" && state.view === "projects" ? state.step : undefined,
    status: libraryViews.has(state.view) ? state.status : undefined,
    q: libraryViews.has(state.view) ? state.q : undefined,
    month: state.view === "calendar" ? state.month : undefined,
  };
}

function WorkspaceNav({
  route,
  views,
  state,
  pages,
  dashboard = false,
}: {
  route: AppRoute;
  views: readonly WorkspaceView[];
  state: WorkspaceUrlState;
  pages: WorkspacePageOption[];
  dashboard?: boolean;
}) {
  return (
    <HorizontalScroller
      label={`Điều hướng ${route.label}`}
      className={dashboard ? "border-t border-[var(--border)] bg-[var(--surface-subtle)]" : "mt-5"}
      contentClassName={dashboard ? "flex gap-1 px-4 py-2" : "flex gap-1 pb-1"}
    >
      <nav className="contents" aria-label={`Điều hướng ${route.label}`}>
      {views.map((view) => {
        const targetScope = view.scope ?? route.scope;
        const allowedScopes = workspaceScopesForRoute(targetScope);
        const scope = allowedScopes.includes(state.scope) ? state.scope : allowedScopes[0];
        const pageId = scope === "current" ? state.pageId ?? pages[0]?.id : undefined;
        const params = workspaceSearchParams(workspaceViewState(route, { ...state, view: view.id, scope, pageId }));
        return (
          <Link
            key={view.id}
            href={`${route.path}?${params.toString()}`}
            aria-current={state.view === view.id ? "page" : undefined}
            className={`flex min-h-11 shrink-0 items-center rounded-md px-3 text-[13px] font-semibold ${state.view === view.id ? "bg-[var(--accent-light)] text-[var(--accent)]" : "text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]"}`}
          >
            {view.label}
          </Link>
        );
      })}
      </nav>
    </HorizontalScroller>
  );
}

function WorkspaceOverview({ route, views, state }: { route: AppRoute; views: readonly WorkspaceView[]; state: WorkspaceUrlState }) {
  return (
    <section aria-labelledby="workspace-overview-heading">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-5">
        <div className="flex items-start gap-3">
          <CheckCircle size={20} weight="fill" className="mt-0.5 shrink-0 text-[var(--accent)]" aria-hidden="true" />
          <div>
            <h2 id="workspace-overview-heading" className="text-lg font-bold">Workspace đã sẵn sàng</h2>
            <p className="mt-1 text-[13px] leading-5 text-[var(--text-muted)]">Navigation, scope và deep link đã dùng URL ổn định. Các màn hình nghiệp vụ đang được chuyển dần mà không chạy song song mutation logic.</p>
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-px overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--border)] md:grid-cols-2">
        {views.filter((view) => view.targetPath).map((view) => {
          const params = workspaceSearchParams({ ...state, view: view.id });
          return (
            <Link key={view.id} href={`${route.path}?${params.toString()}`} className="group bg-[var(--bg-card)] p-5 hover:bg-[var(--accent-soft)]">
              <h3 className="text-[15px] font-bold">{view.label}</h3>
              <p className="mt-1 text-[13px] leading-5 text-[var(--text-muted)]">{view.description}</p>
              <span className="mt-4 flex items-center gap-1 text-xs font-semibold text-[var(--accent)]">Mở view <ArrowRight size={13} aria-hidden="true" /></span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function WorkspaceHandoff({ view, state }: { view: WorkspaceView; state: WorkspaceUrlState }) {
  const params = new URLSearchParams();
  if (state.pageId) params.set("pageId", state.pageId);
  if (state.id) params.set("id", state.id);
  const target = `${view.targetPath}${params.size ? `?${params.toString()}` : ""}`;
  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-6" aria-labelledby="workspace-view-heading">
      <div className="flex items-start gap-3">
        <WarningCircle size={20} className="mt-0.5 shrink-0 text-[var(--amber)]" aria-hidden="true" />
        <div className="min-w-0">
          <h2 id="workspace-view-heading" className="text-lg font-bold">{view.label}</h2>
          <p className="mt-1 text-[13px] leading-5 text-[var(--text-muted)]">{view.description}</p>
          <p className="mt-3 text-[13px] leading-5 text-[var(--text-secondary)]">View này đang dùng màn hình nghiệp vụ hiện tại trong thời gian đạt parity. Mọi thao tác vẫn đi qua một implementation server duy nhất.</p>
          <Link href={target} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-foreground)]">
            Tiếp tục công việc <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
