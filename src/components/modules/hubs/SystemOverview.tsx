import Link from "next/link";
import { ArrowRight, Brain, CheckCircle, SlidersHorizontal, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import type { SystemOverviewData } from "@/lib/system-overview";
import { formatDateTime } from "@/lib/utils";
import { SystemModeControl } from "./SystemModeControl";

export function SystemOverview({ data }: { data: SystemOverviewData }) {
  const brandComplete = data.brandAssets.totalChecks > 0 && data.brandAssets.readyChecks === data.brandAssets.totalChecks;

  return (
    <div className="max-w-6xl space-y-8">
      <header className="border-b border-[var(--border)] pb-6">
        <p className="mb-2 text-[13px] font-semibold text-[var(--accent)]">Khu vực làm việc</p>
        <h1 className="text-[30px] font-extrabold">Hệ thống</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">Theo dõi readiness hiệu lực của cấu hình, tài nguyên thương hiệu và AI Rooms. Mọi thay đổi kỹ thuật vẫn được thực hiện tại Cài đặt & Kết nối.</p>
        <p className="mt-2 text-xs text-[var(--text-muted)]">Nguồn: server readers persisted + deployment policy · đọc lúc {formatDateTime(data.asOf)}</p>
      </header>

      <SystemModeControl />

      <section className="grid gap-px overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--border)] sm:grid-cols-2 lg:grid-cols-4" aria-label="Tóm tắt readiness hệ thống">
        <Metric label="Domain sẵn sàng" value={data.settings.readyCount} tone="success" />
        <Metric label="Cần chú ý" value={data.settings.attentionCount} tone="warning" />
        <Metric label="Safety blocker" value={data.settings.blockedCount} tone="danger" />
        <Metric label="Page đủ brand checks" value={`${data.brandAssets.fullyReadyPages}/${data.brandAssets.pageCount}`} tone={brandComplete ? "success" : "warning"} />
      </section>

      <section aria-labelledby="system-readiness-heading">
        <div className="mb-3 flex items-center gap-2"><SlidersHorizontal size={18} className="text-[var(--accent)]" aria-hidden="true" /><h2 id="system-readiness-heading" className="text-lg font-bold">Readiness cấu hình</h2></div>
        <div className="grid gap-3 lg:grid-cols-2">
          {data.settings.items.map((item) => (
            <Link key={item.id} href={item.href} className="group rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-5 hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]">
              <div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">{item.label}</h3><p className="mt-1 text-sm font-semibold text-[var(--text-secondary)]">{item.summary}</p></div><Status status={item.status} label={item.statusLabel} /></div>
              <p className="mt-3 text-xs leading-5 text-[var(--text-muted)]">{item.detail}</p>
              <div className="mt-4 flex items-center justify-between text-xs"><span className="text-[var(--text-muted)]">Nguồn: {item.source}</span><span className="flex items-center gap-1 font-bold text-[var(--accent)]">Mở Settings <ArrowRight size={13} aria-hidden="true" /></span></div>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2" aria-label="Readiness tài nguyên và AI">
        <Link href="/system/brand-assets?view=overview&scope=account" className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-5 hover:bg-[var(--accent-soft)]">
          <div className="flex items-start justify-between gap-3"><div><h2 className="font-bold">Thương hiệu & Tài nguyên</h2><p className="mt-1 text-sm text-[var(--text-muted)]">Readiness theo Facebook Page và consent.</p></div>{brandComplete ? <CheckCircle size={20} weight="fill" className="text-[var(--success)]" /> : <WarningCircle size={20} className="text-[var(--warning)]" />}</div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><MiniMetric label="Readiness checks" value={`${data.brandAssets.readyChecks}/${data.brandAssets.totalChecks}`} /><MiniMetric label="Brand knowledge" value={data.brandAssets.brandItemCount} /><MiniMetric label="Learning insights" value={data.brandAssets.learningInsightCount} /><MiniMetric label="Page khả dụng" value={data.brandAssets.pageCount} /></div>
          <span className="mt-4 flex items-center gap-1 text-xs font-bold text-[var(--accent)]">Mở Brand & Assets <ArrowRight size={13} /></span>
        </Link>

        <Link href="/system/ai-rooms?view=overview&scope=account" className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-5 hover:bg-[var(--accent-soft)]">
          <div className="flex items-start justify-between gap-3"><div><h2 className="font-bold">Phòng họp AI</h2><p className="mt-1 text-sm text-[var(--text-muted)]">Persisted decisions, skills, approvals và workflows.</p></div><Brain size={20} weight="fill" className="text-[var(--premium)]" /></div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><MiniMetric label="Decisions" value={data.aiRooms.decisions} /><MiniMetric label="Active skills" value={data.aiRooms.activeSkills} /><MiniMetric label="Pending approvals" value={data.aiRooms.pendingApprovals} /><MiniMetric label="Running workflows" value={data.aiRooms.runningWorkflows} /></div>
          <p className="mt-4 text-xs leading-5 text-[var(--text-muted)]">Các số liệu này là record độc lập; không được diễn giải thành một AI session chung hoặc action đã thực thi nếu chưa có trạng thái persisted tương ứng.</p>
          <span className="mt-3 flex items-center gap-1 text-xs font-bold text-[var(--accent)]">Mở AI Rooms <ArrowRight size={13} /></span>
        </Link>
      </section>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string | number; tone: "success" | "warning" | "danger" }) {
  const color = tone === "success" ? "var(--success)" : tone === "warning" ? "var(--warning)" : "var(--danger)";
  return <article className="bg-[var(--bg-card)] p-5"><p className="text-3xl font-extrabold tabular-nums" style={{ color }}>{value}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{label}</p></article>;
}

function MiniMetric({ label, value }: { label: string; value: string | number }) { return <div className="rounded-md bg-[var(--bg-subtle)] p-3"><p className="font-bold">{typeof value === "number" ? value.toLocaleString("vi-VN") : value}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{label}</p></div>; }
function Status({ status, label }: { status: "ready" | "attention" | "blocked" | "info"; label: string }) { const className = status === "ready" ? "bg-[var(--success-light)] text-[var(--success)]" : status === "attention" ? "bg-[var(--amber-light)] text-[var(--amber)]" : status === "blocked" ? "bg-[var(--danger-light)] text-[var(--danger)]" : "bg-[var(--info-light)] text-[var(--info)]"; return <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${className}`}>{label}</span>; }
