import { notFound } from "next/navigation";
import { CareManager } from "@/components/modules/care/CareManager";
import { CLVDashboard } from "@/components/modules/crm/CLVDashboard";
import { WorkspacePermissionState } from "@/components/workspace/WorkspacePermissionState";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { ROUTES_BY_ID } from "@/config/routes";
import { getCustomerCLVSummary } from "@/lib/customer-clv";
import { getAppointmentRequests } from "@/lib/customer-inbox";
import { getCareWorkspaceData, getCustomerDetail, getCustomerWorkspaceData, getScopedLeads } from "@/lib/customer-workspaces";
import { AccessError } from "@/lib/page-access";
import { resolveWorkspaceAccess } from "@/lib/workspace-access";
import { parseWorkspaceUrl, workspaceScopesForRoute } from "@/lib/workspace-url";
import { CustomerCRMView } from "./CustomerCRMView";
import { CustomerSalesView } from "./CustomerSalesView";

export interface CustomerWorkspaceProps {
  routeId: "customers-crm" | "customers-sales" | "customers-care";
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function CustomerWorkspace({ routeId, searchParams }: CustomerWorkspaceProps) {
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
      {routeId === "customers-crm" ? <CRMWorkspaceContent access={access} view={currentView.id} /> : null}
      {routeId === "customers-sales" ? <SalesWorkspaceContent access={access} view={currentView.id} /> : null}
      {routeId === "customers-care" ? <CareWorkspaceContent access={access} view={currentView.id} /> : null}
    </WorkspaceShell>
  );
}

async function CRMWorkspaceContent({
  access,
  view,
}: {
  access: Awaited<ReturnType<typeof resolveWorkspaceAccess>>;
  view: string;
}) {
  if (view === "appointments") {
    const appointments = await getAppointmentRequests();
    return <AppointmentList appointments={appointments} />;
  }
  if (view === "overview") {
    const summary = await getCustomerCLVSummary();
    return (
      <section className="space-y-4">
        <DataScopeNotice>CRM hiện là dữ liệu cấp tài khoản. Hồ sơ chưa lưu Facebook Page nguồn nên không được mô tả là dữ liệu theo Page.</DataScopeNotice>
        <CLVDashboard initialSummary={summary} canMutate={access.canMutate} />
      </section>
    );
  }

  const segment = view === "segments" ? access.state.status : undefined;
  const data = await getCustomerWorkspaceData(segment);
  const customer = access.state.id ? await getCustomerDetail(access.state.id) : null;
  if (access.state.id && !customer) notFound();

  return (
    <section className="space-y-4">
      <DataScopeNotice>Danh sách và hồ sơ khách hàng ở cấp tài khoản; URL lưu hồ sơ và bộ lọc đang xem.</DataScopeNotice>
      <CustomerCRMView
        view={view}
        customers={data.customers}
        stats={data.stats}
        customer={customer}
        canMutate={access.canMutate}
        status={segment}
      />
    </section>
  );
}

async function SalesWorkspaceContent({
  access,
  view,
}: {
  access: Awaited<ReturnType<typeof resolveWorkspaceAccess>>;
  view: string;
}) {
  const pageIds = access.state.scope === "all"
    ? access.pages.map((page) => page.id)
    : access.state.pageId ? [access.state.pageId] : [];
  if (!pageIds.length) return null;

  const data = await getScopedLeads(pageIds, access.state.status);
  return (
    <section className="space-y-4">
      <DataScopeNotice>
        Chỉ hiển thị lead có conversation gắn với Facebook Page trong phạm vi được cấp quyền. Lead thủ công, Zalo hoặc record chưa có Page ownership không xuất hiện ở đây.
      </DataScopeNotice>
      {view === "outreach" ? (
        <DataScopeNotice>Kịch bản AI chỉ được tạo theo yêu cầu owner và không tự gửi ra kênh. Proactive outreach chưa tham gia canonical flow vì customer identity chưa Page-safe.</DataScopeNotice>
      ) : null}
      <CustomerSalesView
        view={view}
        scope={access.state.scope as "current" | "all"}
        pageId={access.state.pageId}
        leads={data.leads}
        stats={data.stats}
        canMutate={access.canMutate}
        status={access.state.status}
      />
    </section>
  );
}

async function CareWorkspaceContent({
  access,
  view,
}: {
  access: Awaited<ReturnType<typeof resolveWorkspaceAccess>>;
  view: string;
}) {
  const status = view === "tasks" ? "pending" : view === "history" ? "sent" : undefined;
  const data = await getCareWorkspaceData(status);
  return (
    <section className="space-y-4">
      <DataScopeNotice>
        CareMessage là draft và trạng thái ghi nhận ở cấp tài khoản. “Đã ghi nhận gửi” không chứng minh có external delivery ID hoặc kênh đã nhận thành công.
      </DataScopeNotice>
      <CareManager
        initialMessages={data.messages}
        initialStats={data.stats}
        initialCustomers={data.customers}
        canMutate={access.canMutate}
        canonical
      />
    </section>
  );
}

function AppointmentList({ appointments }: { appointments: Awaited<ReturnType<typeof getAppointmentRequests>> }) {
  return (
    <section className="space-y-4">
      <DataScopeNotice>Lịch hẹn hiện là dữ liệu cấp tài khoản vì schema chưa lưu Facebook Page nguồn.</DataScopeNotice>
      <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-card)]">
        {appointments.length ? appointments.map((appointment) => (
          <article key={appointment.id} className="border-b border-[var(--border)] p-4 last:border-b-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-[var(--text)]">{appointment.name}</h2>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">{appointment.service || "Chưa ghi dịch vụ"} · {appointment.preferredAt || "Chưa ghi thời gian"}</p>
              </div>
              <span className="rounded-full bg-[var(--bg-subtle)] px-2 py-1 text-[10px] font-semibold text-[var(--text-muted)]">{appointment.status}</span>
            </div>
          </article>
        )) : <p className="p-8 text-center text-sm text-[var(--text-muted)]">Chưa có yêu cầu lịch hẹn.</p>}
      </div>
    </section>
  );
}

function DataScopeNotice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] p-4 text-sm leading-6 text-[var(--text-secondary)]">
      {children}
    </p>
  );
}
