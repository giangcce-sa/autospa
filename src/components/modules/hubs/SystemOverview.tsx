import Link from "next/link";
import { Brain, CheckCircle, CirclesFour, GearSix, Plugs, ShieldCheck, Sparkle, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { DashboardAction, DashboardHeader, DashboardMetric, DashboardPage, DashboardPanel, DashboardStatusStrip } from "@/components/dashboard/Dashboard";
import { DashboardTabPanel, DashboardTabs } from "@/components/dashboard/DashboardTabs";
import { Badge } from "@/components/ui/Badge";
import type { SystemOverviewData } from "@/lib/system-overview";
import { formatDateTime } from "@/lib/utils";
import { SystemModeControl } from "./SystemModeControl";

export function SystemOverview({ data }: { data: SystemOverviewData }) {
  const brandComplete = data.brandAssets.totalChecks > 0 && data.brandAssets.readyChecks === data.brandAssets.totalChecks;
  const healthy = data.settings.blockedCount === 0 && data.settings.attentionCount === 0;

  return (
    <DashboardPage>
      <DashboardHeader
        eyebrow="AI & System Control Room"
        title="Trung tâm điều hành hệ thống"
        description="Một màn hình để đọc readiness, AI workflows, approvals, brand assets và cấu hình hiệu lực. Mọi thay đổi kỹ thuật vẫn được thực hiện tập trung trong Cài đặt & Kết nối."
        meta={`Nguồn persisted + deployment policy · đọc lúc ${formatDateTime(data.asOf)}`}
        actions={<><DashboardAction href="/system/ai-rooms?view=overview&scope=account">Mở AI Rooms</DashboardAction><DashboardAction href="/system/settings?view=overview&scope=account" secondary>Cài đặt hệ thống</DashboardAction></>}
        controls={<SystemModeControl />}
      />

      <DashboardStatusStrip
        tone={healthy ? "success" : data.settings.blockedCount ? "danger" : "warning"}
        title={healthy ? "Hệ thống không có blocker cấu hình" : data.settings.blockedCount ? `${data.settings.blockedCount} safety blocker cần xử lý` : `${data.settings.attentionCount} domain cần chú ý`}
        detail="Control room chỉ phản ánh trạng thái đã đọc từ server; không tự chạy workflow, provider probe hoặc thay đổi cấu hình."
        action={{ href: "/system/settings?view=overview&scope=account", label: "Mở readiness chi tiết" }}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <DashboardMetric label="Domain sẵn sàng" value={data.settings.readyCount} detail="Settings policy" icon={CheckCircle} tone="success" />
        <DashboardMetric label="Cần chú ý" value={data.settings.attentionCount} detail="Không đồng nghĩa lỗi" icon={WarningCircle} tone="warning" />
        <DashboardMetric label="Safety blocker" value={data.settings.blockedCount} detail="Cần owner xử lý" icon={ShieldCheck} tone={data.settings.blockedCount ? "danger" : "success"} />
        <DashboardMetric label="Brand Page ready" value={`${data.brandAssets.fullyReadyPages}/${data.brandAssets.pageCount}`} detail={`${data.brandAssets.readyChecks}/${data.brandAssets.totalChecks} checks`} icon={Sparkle} tone={brandComplete ? "success" : "warning"} href="/system/brand-assets?view=overview&scope=account" />
        <DashboardMetric label="Approval chờ" value={data.aiRooms.pendingApprovals} detail="Persisted, còn hiệu lực" icon={Brain} tone={data.aiRooms.pendingApprovals ? "warning" : "info"} href="/system/ai-rooms?view=approvals&scope=account" />
        <DashboardMetric label="Workflow running" value={data.aiRooms.runningWorkflows} detail={`${data.aiRooms.activeSkills} active skills`} icon={CirclesFour} tone={data.aiRooms.runningWorkflows ? "accent" : "info"} href="/system/ai-rooms?view=orchestrator&scope=account" />
      </div>

      <DashboardTabs items={[{ id: "operations", label: "Vận hành" }, { id: "configuration", label: "Cấu hình" }]}>
        <DashboardTabPanel id="operations" className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.85fr)]">
          <AIControlPanel data={data} />
          <ApprovalPanel data={data} />
        </DashboardTabPanel>

        <DashboardTabPanel id="configuration" className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(20rem,0.7fr)]">
          <ReadinessPanel data={data} />
          <div className="space-y-5">
            <BrandPanel data={data} brandComplete={brandComplete} />
            <SecurityPanel data={data} />
          </div>
        </DashboardTabPanel>
      </DashboardTabs>
    </DashboardPage>
  );
}

function AIControlPanel({ data }: { data: SystemOverviewData }) {
  const rooms = [
    { title: "Phòng tư vấn", detail: `${data.aiRooms.decisions} quyết định persisted`, href: "/system/ai-rooms?view=council&scope=account", icon: Brain, tone: "var(--accent)" },
    { title: "Bộ não kỹ năng", detail: `${data.aiRooms.activeSkills} skill đang active`, href: "/system/ai-rooms?view=brain&scope=account", icon: Sparkle, tone: "var(--premium)" },
    { title: "Trung tâm điều phối", detail: `${data.aiRooms.runningWorkflows} workflow đang running`, href: "/system/ai-rooms?view=orchestrator&scope=account", icon: CirclesFour, tone: "var(--info)" },
    { title: "Bộ nhớ quyết định", detail: `${data.aiRooms.decisions} outcome records`, href: "/system/ai-rooms?view=memory&scope=account", icon: ShieldCheck, tone: "var(--success)" },
  ];
  return (
    <DashboardPanel title="AI agents và phòng điều hành" description="Các count là record độc lập, không được diễn giải thành một AI session chung" action={{ href: "/system/ai-rooms?view=overview&scope=account", label: "Mở control room" }}>
      <div className="grid gap-3 sm:grid-cols-2">
        {rooms.map((room) => <Link key={room.title} href={room.href} className="card-hover rounded-[11px] border border-[var(--border)] bg-[var(--bg-subtle)] p-4"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[var(--bg-card)] shadow-sm" style={{ color: room.tone }}><room.icon size={19} weight="fill" /></span><div><h3 className="text-sm font-extrabold">{room.title}</h3><p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{room.detail}</p></div></div></Link>)}
      </div>
      <div className="mt-4 rounded-[10px] border border-[var(--border)] bg-[var(--bg-card)] p-4">
        <div className="flex items-center justify-between gap-3"><p className="text-sm font-bold">Workflow health</p><Badge variant={data.aiRooms.runningWorkflows ? "warning" : "neutral"}>{data.aiRooms.runningWorkflows ? "Đang chạy" : "Không có run active"}</Badge></div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--bg-subtle)]"><div className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--info)]" style={{ width: data.aiRooms.runningWorkflows ? "68%" : "0%" }} /></div>
        <p className="mt-2 text-[11px] leading-5 text-[var(--text-muted)]">Thanh trạng thái chỉ biểu đạt có workflow running; không phải phần trăm tiến độ nếu persisted steps không cung cấp completion.</p>
      </div>
    </DashboardPanel>
  );
}

function ApprovalPanel({ data }: { data: SystemOverviewData }) {
  return (
    <DashboardPanel title="Approval center" description="Owner review trước execution" badge={{ label: `${data.aiRooms.pendingApprovals} chờ`, variant: data.aiRooms.pendingApprovals ? "warning" : "success" }} action={{ href: "/system/ai-rooms?view=approvals&scope=account", label: "Mở phê duyệt" }}>
      <div className="flex min-h-44 flex-col items-center justify-center rounded-[11px] bg-[var(--bg-subtle)] p-5 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--warning-light)] text-[var(--warning)]"><ShieldCheck size={23} weight="fill" /></span>
        <p className="mt-3 text-3xl font-extrabold tabular-nums">{data.aiRooms.pendingApprovals}</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">approval còn hiệu lực</p>
        <p className="mt-4 text-xs leading-5 text-[var(--text-secondary)]">Approve/reject chỉ xuất hiện trong AI Rooms cho owner và vẫn được API enforce, audit.</p>
      </div>
    </DashboardPanel>
  );
}

function ReadinessPanel({ data }: { data: SystemOverviewData }) {
  return (
    <DashboardPanel title="Readiness cấu hình" description="Trạng thái hiệu lực; chỉnh sửa tập trung trong Settings" action={{ href: "/system/settings?view=overview&scope=account", label: "Mở Settings" }} padding={false}>
      {data.settings.items.map((item) => (
        <Link key={item.id} href={item.href} className="row-hover grid gap-3 border-b border-[var(--border)] px-4 py-4 last:border-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-5">
          <div><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold">{item.label}</h3><Status status={item.status} label={item.statusLabel} /></div><p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{item.summary}</p><p className="mt-1 text-[11px] leading-5 text-[var(--text-muted)]">{item.detail}</p></div>
          <p className="text-[10px] font-semibold text-[var(--text-muted)] sm:text-right">Nguồn<br />{item.source}</p>
        </Link>
      ))}
    </DashboardPanel>
  );
}

function BrandPanel({ data, brandComplete }: { data: SystemOverviewData; brandComplete: boolean }) {
  return <DashboardPanel title="Brand & Assets" description="Readiness theo Page và consent" badge={{ label: brandComplete ? "Sẵn sàng" : "Cần bổ sung", variant: brandComplete ? "success" : "warning" }} action={{ href: "/system/brand-assets?view=overview&scope=account", label: "Mở tài nguyên" }}><div className="grid grid-cols-2 gap-3"><MiniMetric label="Readiness checks" value={`${data.brandAssets.readyChecks}/${data.brandAssets.totalChecks}`} /><MiniMetric label="Page khả dụng" value={data.brandAssets.pageCount} /><MiniMetric label="Brand knowledge" value={data.brandAssets.brandItemCount} /><MiniMetric label="Learning insights" value={data.brandAssets.learningInsightCount} /></div></DashboardPanel>;
}

function SecurityPanel({ data }: { data: SystemOverviewData }) {
  return <DashboardPanel title="Security & deployment" description="Public summary, không lộ secret" action={{ href: "/system/settings?view=security&scope=account", label: "Mở bảo mật" }}><div className="flex items-center gap-3"><span className={`flex h-11 w-11 items-center justify-center rounded-[11px] ${data.settings.blockedCount ? "bg-[var(--danger-light)] text-[var(--danger)]" : "bg-[var(--success-light)] text-[var(--success)]"}`}>{data.settings.blockedCount ? <WarningCircle size={21} /> : <ShieldCheck size={21} weight="fill" />}</span><div><p className="text-sm font-bold">{data.settings.blockedCount ? "Có blocker cấu hình" : "Không có blocker trong summary"}</p><p className="mt-1 text-xs text-[var(--text-muted)]">Secret values không được gửi xuống control room.</p></div></div><Link href="/system/settings?view=connections&scope=account" className="mt-4 flex min-h-11 items-center justify-between rounded-[9px] border border-[var(--border)] px-3 text-xs font-bold"><span className="flex items-center gap-2"><Plugs size={16} />Kết nối & provider</span><GearSix size={16} className="text-[var(--text-muted)]" /></Link></DashboardPanel>;
}

function MiniMetric({ label, value }: { label: string; value: string | number }) { return <div className="rounded-[9px] bg-[var(--bg-subtle)] p-3"><p className="text-lg font-extrabold tabular-nums">{typeof value === "number" ? value.toLocaleString("vi-VN") : value}</p><p className="mt-1 text-[11px] text-[var(--text-muted)]">{label}</p></div>; }
function Status({ status, label }: { status: "ready" | "attention" | "blocked" | "info"; label: string }) { const variant = status === "ready" ? "success" : status === "attention" ? "warning" : status === "blocked" ? "danger" : "info"; return <Badge variant={variant}>{label}</Badge>; }
