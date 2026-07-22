import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle, Plugs, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import type { AppRoute, RouteScope, WorkspaceView } from "@/config/routes";
import { EmptyState } from "@/components/ui/EmptyState";
import type { WorkspacePageOption } from "@/lib/workspace-access";
import { workspaceScopesForRoute, workspaceSearchParams, type WorkspaceUrlState } from "@/lib/workspace-url";

const SCOPE_LABELS = {
  current: "Trang hiện tại",
  all: "Tất cả Trang được phép",
  account: "Toàn tài khoản",
} as const;

export function WorkspaceShell({
  route,
  state,
  pages,
  effectiveScope = route.scope,
  children,
}: {
  route: AppRoute;
  state: WorkspaceUrlState;
  pages: WorkspacePageOption[];
  effectiveScope?: RouteScope;
  children?: ReactNode;
}) {
  const views = route.views ?? [];
  const currentView = views.find((view) => view.id === state.view) ?? views[0];

  return (
    <div className="max-w-6xl space-y-6">
      <header className="border-b border-[var(--border)] pb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[13px] font-semibold text-[var(--accent)]">Phần mềm chức năng</p>
            <h1 className="mt-1 text-[30px] font-extrabold">{route.label}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">{route.description}</p>
          </div>
          <WorkspaceScopeControl route={route} state={state} pages={pages} effectiveScope={effectiveScope} />
        </div>
        <WorkspaceNav route={route} views={views} state={state} pages={pages} />
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

function WorkspaceScopeControl({
  route,
  state,
  pages,
  effectiveScope,
}: {
  route: AppRoute;
  state: WorkspaceUrlState;
  pages: WorkspacePageOption[];
  effectiveScope: RouteScope;
}) {
  const scopes = workspaceScopesForRoute(effectiveScope);

  if (scopes.length === 1 && scopes[0] === "account") {
    return (
      <span className="rounded-md border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]">
        {SCOPE_LABELS.account}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2" aria-label="Phạm vi dữ liệu">
      {pages.length > 0 && state.scope === "current" && (
        <div className="flex flex-wrap gap-1">
          {pages.map((page) => {
            const params = workspaceSearchParams({ ...state, scope: "current", pageId: page.id });
            return (
              <Link
                key={page.id}
                href={`${route.path}?${params.toString()}`}
                aria-current={state.pageId === page.id ? "true" : undefined}
                className={`inline-flex min-h-11 items-center rounded-md border px-3 text-xs font-semibold ${state.pageId === page.id ? "border-[var(--accent)] bg-[var(--accent-light)] text-[var(--accent)]" : "border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)]"}`}
              >
                {page.pageName}
              </Link>
            );
          })}
        </div>
      )}
      {scopes.length > 1 && (
        <div className="flex gap-1 rounded-md border border-[var(--border)] bg-[var(--bg-subtle)] p-1">
          {scopes.map((scope) => {
            const pageId = scope === "current" ? state.pageId ?? pages[0]?.id : undefined;
            const params = workspaceSearchParams({ ...state, scope, pageId });
            return (
              <Link
                key={scope}
                href={`${route.path}?${params.toString()}`}
                aria-current={state.scope === scope ? "true" : undefined}
                className={`inline-flex min-h-9 items-center rounded px-3 text-xs font-semibold ${state.scope === scope ? "bg-[var(--bg-card)] text-[var(--accent)] shadow-sm" : "text-[var(--text-muted)]"}`}
              >
                {SCOPE_LABELS[scope]}
              </Link>
            );
          })}
        </div>
      )}
      {scopes.length === 1 && (
        <span className="rounded-md border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]">
          {SCOPE_LABELS[state.scope]}
        </span>
      )}
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

function WorkspaceNav({
  route,
  views,
  state,
  pages,
}: {
  route: AppRoute;
  views: readonly WorkspaceView[];
  state: WorkspaceUrlState;
  pages: WorkspacePageOption[];
}) {
  return (
    <nav className="mt-5 flex gap-1 overflow-x-auto pb-1" aria-label={`Điều hướng ${route.label}`}>
      {views.map((view) => {
        const targetScope = view.scope ?? route.scope;
        const allowedScopes = workspaceScopesForRoute(targetScope);
        const scope = allowedScopes.includes(state.scope) ? state.scope : allowedScopes[0];
        const pageId = scope === "current" ? state.pageId ?? pages[0]?.id : undefined;
        const params = workspaceSearchParams({ ...state, view: view.id, scope, pageId });
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
