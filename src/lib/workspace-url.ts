export const WORKSPACE_SCOPES = ["current", "all", "account"] as const;
export type WorkspaceScope = (typeof WORKSPACE_SCOPES)[number];
export type WorkspaceRouteScope = "current_page" | "current_or_all" | "account" | "none";

export function workspaceScopesForRoute(scope: WorkspaceRouteScope): readonly WorkspaceScope[] {
  if (scope === "current_page") return ["current"];
  if (scope === "current_or_all") return ["current", "all"];
  return ["account"];
}

export interface WorkspaceUrlState {
  view: string;
  scope: WorkspaceScope;
  pageId?: string;
  id?: string;
  status?: string;
  q?: string;
  domain?: string;
  category?: string;
  risk?: string;
  step?: string;
  month?: string;
}

type SearchValue = string | string[] | undefined;
type SearchParams = Record<string, SearchValue>;

function single(value: SearchValue) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function parseWorkspaceUrl(
  params: SearchParams,
  options: {
    views: readonly string[];
    defaultView: string;
    defaultScope: WorkspaceScope;
    allowedScopes?: readonly WorkspaceScope[];
  },
): WorkspaceUrlState {
  const requestedView = single(params.view);
  const requestedScope = single(params.scope);
  const allowedScopes = options.allowedScopes ?? WORKSPACE_SCOPES;
  const scope = allowedScopes.includes(requestedScope as WorkspaceScope)
    ? requestedScope as WorkspaceScope
    : options.defaultScope;
  return {
    view: requestedView && options.views.includes(requestedView) ? requestedView : options.defaultView,
    scope,
    pageId: single(params.pageId),
    id: single(params.id),
    status: single(params.status),
    q: single(params.q),
    domain: single(params.domain),
    category: single(params.category),
    risk: single(params.risk),
    step: single(params.step),
    month: single(params.month),
  };
}

export function workspaceSearchParams(state: WorkspaceUrlState) {
  const params = new URLSearchParams({ view: state.view, scope: state.scope });
  for (const key of ["pageId", "id", "status", "q", "domain", "category", "risk", "step", "month"] as const) {
    if (state[key]) params.set(key, state[key]);
  }
  return params;
}
