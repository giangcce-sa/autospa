import { notFound } from "next/navigation";
import { MessageRules } from "@/components/modules/inbox/MessageRules";
import { WorkspacePermissionState } from "@/components/workspace/WorkspacePermissionState";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { ROUTES_BY_ID } from "@/config/routes";
import { getInboxMessage, getInboxMessages, getMessageRules } from "@/lib/customer-inbox";
import { AccessError } from "@/lib/page-access";
import { resolveWorkspaceAccess } from "@/lib/workspace-access";
import { parseWorkspaceUrl, workspaceScopesForRoute } from "@/lib/workspace-url";
import { CustomerInboxView } from "./CustomerInboxView";

export interface CustomerInboxWorkspaceProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function CustomerInboxWorkspace({ searchParams }: CustomerInboxWorkspaceProps) {
  const route = ROUTES_BY_ID.get("customers-inbox");
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
  try {
    access = await resolveWorkspaceAccess(route, state, effectiveScope);
  } catch (error) {
    if (error instanceof AccessError && error.status === 403) {
      return <WorkspacePermissionState route={route} message={error.message} />;
    }
    throw error;
  }

  const pageId = access.state.pageId;
  let messages: Awaited<ReturnType<typeof getInboxMessages>> = [];
  let selectedMessage: Awaited<ReturnType<typeof getInboxMessage>> = null;

  if (pageId && (access.state.view === "queue" || access.state.view === "conversation")) {
    messages = await getInboxMessages(pageId);
    if (access.state.id) {
      try {
        selectedMessage = await getInboxMessage(pageId, access.state.id);
      } catch (error) {
        if (error instanceof AccessError && error.status === 403) {
          return <WorkspacePermissionState route={route} message={error.message} />;
        }
        throw error;
      }
      if (!selectedMessage) notFound();
    }
  }

  const rules = access.state.view === "rules" ? await getMessageRules() : undefined;

  return (
    <WorkspaceShell route={route} state={access.state} pages={access.pages} effectiveScope={effectiveScope} visibleViewIds={access.visibleViewIds} dashboard wide>
      {pageId && (access.state.view === "queue" || access.state.view === "conversation") ? (
        <CustomerInboxView
          facebookPageId={pageId}
          view={access.state.view}
          initialMessages={messages}
          selectedMessage={selectedMessage}
          canMutate={access.canMutate}
          status={access.state.status}
          q={access.state.q}
        />
      ) : null}
      {access.state.view === "appointments" ? <AppointmentsOwnershipState /> : null}
      {access.state.view === "rules" && rules ? (
        <section className="space-y-4">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] p-4 text-sm text-[var(--text-secondary)]">
            Các quy tắc hiện áp dụng ở cấp tài khoản cho Facebook và Zalo, không chỉ Facebook Page đang chọn. Chỉ owner có thể thay đổi hoặc chạy thử quy tắc.
          </div>
          <MessageRules initialRules={rules} canMutate={access.canMutate} />
        </section>
      ) : null}
    </WorkspaceShell>
  );
}

function AppointmentsOwnershipState() {
  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-5">
      <h2 className="text-base font-bold text-[var(--text)]">Lịch hẹn chưa có ownership theo Facebook Page</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
        Dữ liệu lịch hẹn hiện ở cấp tài khoản và chưa lưu Facebook Page nguồn. View này được khóa để tránh hiển thị lịch hẹn của Page khác trong workspace hiện tại.
      </p>
    </section>
  );
}
