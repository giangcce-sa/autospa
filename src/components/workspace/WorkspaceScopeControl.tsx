"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { workspaceScopesForRoute, workspaceSearchParams, type WorkspaceUrlState } from "@/lib/workspace-url";
import type { RouteScope } from "@/config/routes";
import type { WorkspacePageOption } from "@/lib/workspace-access";

const SCOPE_LABELS = {
  current: "Trang hiện tại",
  all: "Tất cả Trang được phép",
  account: "Toàn tài khoản",
} as const;

export function WorkspaceScopeControl({
  routePath,
  state,
  pages,
  effectiveScope,
}: {
  routePath: string;
  state: WorkspaceUrlState;
  pages: WorkspacePageOption[];
  effectiveScope: RouteScope;
}) {
  const router = useRouter();
  const scopes = workspaceScopesForRoute(effectiveScope);

  if (scopes.length === 1 && scopes[0] === "account") {
    return <ScopeLabel>{SCOPE_LABELS.account}</ScopeLabel>;
  }

  const pageHref = (pageId: string) => {
    const params = workspaceSearchParams({ ...state, scope: "current", pageId, id: undefined, step: undefined });
    return `${routePath}?${params.toString()}`;
  };

  return (
    <div className="flex min-w-0 flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end" aria-label="Phạm vi dữ liệu">
      {pages.length > 0 && state.scope === "current" ? (
        <label className="min-w-0">
          <span className="sr-only">Facebook Page hiện tại</span>
          <select
            value={state.pageId ?? pages[0]?.id ?? ""}
            onChange={(event) => router.push(pageHref(event.target.value))}
            className="min-h-11 w-full max-w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-card)] px-3 pr-9 text-xs font-semibold text-[var(--text)] sm:w-auto sm:max-w-64"
          >
            {pages.map((page) => <option key={page.id} value={page.id}>{page.pageName}</option>)}
          </select>
        </label>
      ) : null}
      {scopes.length > 1 ? (
        <div className="flex min-w-0 gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-subtle)] p-1">
          {scopes.map((scope) => {
            const pageId = scope === "current" ? state.pageId ?? pages[0]?.id : undefined;
            const params = workspaceSearchParams({ ...state, scope, pageId, id: undefined, step: undefined });
            return (
              <Link
                key={scope}
                href={`${routePath}?${params.toString()}`}
                aria-current={state.scope === scope ? "true" : undefined}
                className={`inline-flex min-h-9 min-w-0 flex-1 items-center justify-center rounded-[var(--radius-sm)] px-3 text-center text-xs font-semibold sm:flex-none ${state.scope === scope ? "bg-[var(--surface-card)] text-[var(--accent)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text)]"}`}
              >
                {SCOPE_LABELS[scope]}
              </Link>
            );
          })}
        </div>
      ) : <ScopeLabel>{SCOPE_LABELS[state.scope]}</ScopeLabel>}
    </div>
  );
}

function ScopeLabel({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex min-h-11 items-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 text-xs font-semibold text-[var(--text-secondary)]">{children}</span>;
}
