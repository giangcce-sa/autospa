import "server-only";

import type { AppRoute } from "@/config/routes";
import { prisma } from "@/lib/db";
import { AccessError, getAuthorizedPageIds, requireUser } from "@/lib/page-access";
import type { WorkspaceUrlState } from "@/lib/workspace-url";

export interface WorkspacePageOption {
  id: string;
  pageName: string;
}

export interface WorkspaceAccess {
  state: WorkspaceUrlState;
  pages: WorkspacePageOption[];
  canMutate: boolean;
  visibleViewIds: string[];
}

export async function resolveWorkspaceAccess(
  route: AppRoute,
  state: WorkspaceUrlState,
  effectiveScope = route.scope,
): Promise<WorkspaceAccess> {
  const selectedView = route.views?.find((view) => view.id === state.view);
  const user = await requireUser({ owner: route.ownerOnly || selectedView?.ownerOnly });
  const visibleViewIds = (route.views ?? [])
    .filter((view) => !view.ownerOnly || user.role === "owner")
    .map((view) => view.id);

  if (effectiveScope === "account" || effectiveScope === "none") {
    return {
      state: { ...state, scope: "account", pageId: undefined },
      pages: [],
      canMutate: user.role === "owner",
      visibleViewIds,
    };
  }

  const authorizedPageIds = await getAuthorizedPageIds(user);
  const pages = await prisma.facebookPage.findMany({
    where: {
      ...(authorizedPageIds ? { id: { in: authorizedPageIds } } : {}),
      ...(user.role === "owner" ? {} : { isActive: true }),
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, pageName: true },
  });

  if (!pages.length) {
    return {
      state: { ...state, scope: "current", pageId: undefined },
      pages,
      canMutate: user.role === "owner",
      visibleViewIds,
    };
  }

  if (state.scope === "all") {
    if (effectiveScope !== "current_or_all") {
      throw new AccessError("Workspace này không hỗ trợ phạm vi tất cả Trang", 403);
    }

    return {
      state: { ...state, scope: "all", pageId: undefined },
      pages,
      canMutate: user.role === "owner",
      visibleViewIds,
    };
  }

  const pageId = state.pageId ?? pages[0].id;
  if (!pages.some((page) => page.id === pageId)) {
    throw new AccessError("Tài khoản không có quyền truy cập Facebook Page này", 403);
  }

  return {
    state: { ...state, scope: "current", pageId },
    pages,
    canMutate: user.role === "owner",
    visibleViewIds,
  };
}
