import Link from "next/link";
import { AddressBook, ChatCircleDots, Heart, Target } from "@phosphor-icons/react/dist/ssr";
import { DashboardAction, DashboardHeader, DashboardMetric, DashboardPage, DashboardPanel, DashboardStatusStrip } from "@/components/dashboard/Dashboard";
import { DashboardTabPanel, DashboardTabs } from "@/components/dashboard/DashboardTabs";
import type { CustomerOverviewData } from "@/lib/customer-overview";
import type { WorkspaceAccess } from "@/lib/workspace-access";

export function CustomerOverview({ data, access }: { data: CustomerOverviewData; access: WorkspaceAccess }) {
  const currentPageId = access.state.pageId;
  const pageParam = currentPageId ? `&pageId=${encodeURIComponent(currentPageId)}` : "";
  const salesScope = `scope=${access.state.scope}${pageParam}`;
  const inboxHref = currentPageId
    ? `/customers/inbox?view=queue&scope=current&pageId=${encodeURIComponent(currentPageId)}`
    : "/customers/inbox?view=queue&scope=current";

  return (
    <DashboardPage>
      <DashboardHeader
        eyebrow="Customer Operations"
        title="Hội thoại & Lead"
        description="Điều hành message records, lead thuộc Page được cấp quyền, CRM và công việc chăm sóc mà không trộn lẫn phạm vi sở hữu dữ liệu."
        meta={`Tổng hợp persisted data · đọc lúc ${formatTime(data.asOf)} · không gọi Meta hoặc AI provider`}
        actions={<><DashboardAction href={inboxHref}>Mở Hộp thư</DashboardAction><DashboardAction href={`/customers/sales?view=pipeline&${salesScope}`} secondary>Xem pipeline</DashboardAction></>}
        controls={<CustomerScopeControl access={access} />}
      />

      <DashboardStatusStrip
        tone={currentPageId ? "info" : "warning"}
        title={currentPageId ? "Đang tách đúng Page scope và account scope" : "Chưa chọn được Facebook Page cho Inbox"}
        detail={currentPageId ? "Inbox chỉ đọc Page hiện tại; Sales dùng Page được authorize; CRM và Care tiếp tục là dữ liệu cấp tài khoản." : "Inbox và Sales không được suy diễn từ CRM account data. Kết nối hoặc chọn Page để mở dữ liệu Page-safe."}
        meta={`Inbox: ${data.inbox.source} · Sales: ${data.sales.source} · CRM/Care: account scope`}
        action={currentPageId ? undefined : { href: "/system/settings?view=channels&scope=account", label: "Kiểm tra kết nối" }}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardMetric label="Message records" value={data.inbox.records.length || "Chưa có"} detail={data.inbox.handled == null ? "Cần chọn Page hiện tại" : `${data.inbox.handled} record được legacy workflow đánh dấu xử lý`} icon={ChatCircleDots} unavailable={data.inbox.availability === "unavailable"} href={inboxHref} />
        <DashboardMetric label="Lead Page-safe" value={data.sales.stats?.total ?? "Chưa có"} detail="Có conversation thuộc Page được phép" icon={Target} tone={data.sales.stats ? "accent" : "warning"} unavailable={!data.sales.stats} href={`/customers/sales?view=overview&${salesScope}`} />
        <DashboardMetric label="Khách hàng CRM" value={data.crm.stats.total} detail="Persisted ở cấp tài khoản" icon={AddressBook} tone="info" href="/customers/crm?view=customers&scope=account" />
        <DashboardMetric label="Care cần review" value={data.care.stats.pending} detail={`${data.care.stats.sent} record đã ghi nhận gửi`} icon={Heart} tone={data.care.stats.pending ? "warning" : "success"} href="/customers/care?view=tasks&scope=account" />
      </div>

      <DashboardTabs items={[{ id: "inbox", label: "Hộp thư" }, { id: "leads", label: "Lead" }, { id: "account", label: "CRM & Care" }]}>
        <DashboardTabPanel id="inbox" className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
          <InboxPreview data={data} href={inboxHref} currentPageId={currentPageId} />
          <InboxFacts data={data} />
        </DashboardTabPanel>
        <DashboardTabPanel id="leads" className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
          <LeadPreview data={data} scopeParams={salesScope} />
          <PipelineSummary data={data} scopeParams={salesScope} />
        </DashboardTabPanel>
        <DashboardTabPanel id="account" className="grid gap-5 xl:grid-cols-2">
          <CRMPreview data={data} />
          <CarePreview data={data} />
        </DashboardTabPanel>
      </DashboardTabs>
    </DashboardPage>
  );
}

function CustomerScopeControl({ access }: { access: WorkspaceAccess }) {
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Phạm vi dữ liệu khách hàng">
      <Link href="/customers?scope=all" aria-current={access.state.scope === "all" ? "page" : undefined} className={scopeClass(access.state.scope === "all")}>Tất cả Trang</Link>
      {access.pages.map((page) => (
        <Link key={page.id} href={`/customers?scope=current&pageId=${encodeURIComponent(page.id)}`} aria-current={access.state.pageId === page.id ? "page" : undefined} className={scopeClass(access.state.pageId === page.id)}>{page.pageName}</Link>
      ))}
    </div>
  );
}

function InboxPreview({ data, href, currentPageId }: { data: CustomerOverviewData; href: string; currentPageId?: string }) {
  return (
    <DashboardPanel title="Hàng đợi theo Facebook Page" description="Message records gần nhất, không phải complete conversation thread" action={{ href, label: "Mở Hộp thư" }} padding={false}>
      {data.inbox.records.length ? data.inbox.records.map((message) => (
        <Link key={message.id} href={`/customers/inbox?view=conversation&scope=current&pageId=${encodeURIComponent(currentPageId!)}&id=${encodeURIComponent(message.id)}`} className="row-hover grid min-h-11 gap-2 border-b border-[var(--border)] px-4 py-4 last:border-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-5">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-bold">{message.senderName}</h3><span className="rounded-full bg-[var(--bg-subtle)] px-2 py-0.5 text-[10px] font-bold text-[var(--text-muted)]">{message.reply ? "Có reply lưu" : "Chưa có reply"}</span></div><p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-secondary)]">{message.message}</p></div>
          <div className="text-xs text-[var(--text-muted)] sm:text-right"><time>{formatTime(message.createdAt)}</time><span className="mt-1 block">{message.isRead ? "Legacy: đã xử lý" : "Legacy: chưa đánh dấu"}</span></div>
        </Link>
      )) : <Empty message={data.inbox.warning ?? "Chưa có message record."} />}
    </DashboardPanel>
  );
}

function InboxFacts({ data }: { data: CustomerOverviewData }) {
  return <DashboardPanel title="Tính trung thực của Inbox" description="Ranh giới dữ liệu đang áp dụng" badge={{ label: data.inbox.availability, variant: data.inbox.availability === "available" ? "info" : "warning" }}><Fact label="Nguồn" value={data.inbox.source} /><Fact label="Phạm vi" value="Facebook Page hiện tại" /><Fact label="Reply được lưu" value={data.inbox.savedReplies == null ? "Chưa khả dụng" : String(data.inbox.savedReplies)} /><Fact label="Đọc lúc" value={formatTime(data.inbox.asOf)} /><p className="mt-4 text-xs leading-5 text-[var(--warning)]">{data.inbox.warning}</p></DashboardPanel>;
}

function LeadPreview({ data, scopeParams }: { data: CustomerOverviewData; scopeParams: string }) {
  return <DashboardPanel title="Lead cần xử lý" description="Chỉ lead có conversation thuộc Page được cấp quyền" action={{ href: `/customers/sales?view=pipeline&${scopeParams}`, label: "Mở pipeline" }} padding={false}>{data.sales.leads.length ? data.sales.leads.map((lead) => <Link key={lead.id} href={`/customers/sales?view=pipeline&${scopeParams}&id=${encodeURIComponent(lead.id)}`} className="row-hover grid gap-3 border-b border-[var(--border)] px-4 py-4 last:border-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-5"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold">{lead.name}</h3><span className="rounded-full bg-[var(--accent-light)] px-2 py-0.5 text-[10px] font-bold text-[var(--accent)]">{lead.stage}</span></div><p className="mt-1 text-xs text-[var(--text-muted)]">{lead.service ?? "Chưa ghi dịch vụ"} · {lead.source}</p></div><div className="text-xs text-[var(--text-muted)] sm:text-right"><strong className="block text-sm text-[var(--text)]">{lead.score}</strong><span>lead score persisted</span></div></Link>) : <Empty message={data.sales.warning ?? "Chưa có lead Page-safe."} />}</DashboardPanel>;
}

function PipelineSummary({ data, scopeParams }: { data: CustomerOverviewData; scopeParams: string }) {
  const stats = data.sales.stats;
  return <DashboardPanel title="Pipeline persisted" description="Stage counts, không phải conversion funnel" badge={{ label: data.sales.availability, variant: stats ? "success" : "warning" }} action={{ href: `/customers/sales?view=results&${scopeParams}`, label: "Xem kết quả" }}><div className="grid grid-cols-2 gap-3"><SmallMetric label="Hot" value={stats?.hot ?? "—"} /><SmallMetric label="Warm" value={stats?.warm ?? "—"} /><SmallMetric label="Cold" value={stats?.cold ?? "—"} /><SmallMetric label="Closed" value={stats?.closed ?? "—"} /></div><p className="mt-4 text-xs leading-5 text-[var(--warning)]">{data.sales.warning}</p></DashboardPanel>;
}

function CRMPreview({ data }: { data: CustomerOverviewData }) {
  return <DashboardPanel title="CRM cấp tài khoản" description="Hồ sơ không có Facebook Page ownership" action={{ href: "/customers/crm?view=customers&scope=account", label: "Mở CRM" }} padding={false}>{data.crm.customers.length ? data.crm.customers.map((customer) => <Link key={customer.id} href={`/customers/crm?view=customers&scope=account&id=${encodeURIComponent(customer.id)}`} className="row-hover flex min-h-11 items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-4 last:border-0 sm:px-5"><div className="min-w-0"><h3 className="truncate text-sm font-bold">{customer.name}</h3><p className="mt-1 text-xs text-[var(--text-muted)]">{customer.segment} · cập nhật {formatTime(customer.updatedAt)}</p></div><span className="text-xs font-bold text-[var(--accent)]">{customer.leadScore}</span></Link>) : <Empty message="Chưa có Customer persisted." />}</DashboardPanel>;
}

function CarePreview({ data }: { data: CustomerOverviewData }) {
  return <DashboardPanel title="Care cấp tài khoản" description="Sent là trạng thái ghi nhận, không phải delivery proof" action={{ href: "/customers/care?view=tasks&scope=account", label: "Mở công việc" }} padding={false}>{data.care.messages.length ? data.care.messages.map((message) => <article key={message.id} className="grid gap-2 border-b border-[var(--border)] px-4 py-4 last:border-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-5"><div className="min-w-0"><h3 className="text-sm font-bold">{message.customer?.name ?? "Chưa gắn khách hàng"}</h3><p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-secondary)]">{message.content}</p></div><div className="text-xs font-bold text-[var(--text-muted)] sm:text-right">{message.status === "sent" ? "Đã ghi nhận gửi" : message.status}</div></article>) : <Empty message="Chưa có CareMessage persisted." />}</DashboardPanel>;
}

function Fact({ label, value }: { label: string; value: string }) { return <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] py-3 last:border-0"><span className="text-xs text-[var(--text-muted)]">{label}</span><strong className="max-w-[65%] text-right text-xs leading-5">{value}</strong></div>; }
function SmallMetric({ label, value }: { label: string; value: string | number }) { return <div className="rounded-[9px] bg-[var(--bg-subtle)] p-3"><p className="text-lg font-extrabold tabular-nums">{typeof value === "number" ? value.toLocaleString("vi-VN") : value}</p><p className="mt-1 text-[11px] text-[var(--text-muted)]">{label}</p></div>; }
function Empty({ message }: { message: string }) { return <p className="p-8 text-center text-sm leading-6 text-[var(--text-muted)]">{message}</p>; }
function scopeClass(active: boolean) { return `inline-flex min-h-11 items-center rounded-[8px] px-3 text-xs font-bold ${active ? "bg-[var(--accent)] text-white" : "border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)]"}`; }
function formatTime(value: string) { return new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }); }
