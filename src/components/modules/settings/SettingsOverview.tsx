import Link from "next/link";
import {
  ArrowRight,
  CheckCircle,
  Info,
  SlidersHorizontal,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react/dist/ssr";
import type { SettingsOverviewData, SettingsOverviewStatus } from "@/lib/settings/overview-policy";

const STATUS_STYLE: Record<SettingsOverviewStatus, { icon: typeof CheckCircle; className: string }> = {
  ready: { icon: CheckCircle, className: "bg-[var(--success-light)] text-[var(--success)]" },
  attention: { icon: WarningCircle, className: "bg-[var(--amber-light)] text-[var(--amber)]" },
  blocked: { icon: XCircle, className: "bg-[var(--danger-light)] text-[var(--danger)]" },
  info: { icon: Info, className: "bg-[var(--info-light)] text-[var(--info)]" },
};

export function SettingsOverview({ data }: { data: SettingsOverviewData }) {
  return (
    <div className="space-y-5">
      <section className="grid gap-px overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--border)] sm:grid-cols-3">
        <div className="bg-[var(--bg-card)] p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Sẵn sàng</p>
          <p className="mt-2 text-3xl font-extrabold tabular-nums text-[var(--success)]">{data.readyCount}</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">domain có cấu hình khả dụng</p>
        </div>
        <div className="bg-[var(--bg-card)] p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Cần chú ý</p>
          <p className="mt-2 text-3xl font-extrabold tabular-nums text-[var(--amber)]">{data.attentionCount}</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">domain chưa hoàn tất hoặc đang mô phỏng</p>
        </div>
        <div className="bg-[var(--bg-card)] p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Đang chặn</p>
          <p className="mt-2 text-3xl font-extrabold tabular-nums text-[var(--danger)]">{data.blockedCount}</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">domain có safety blocker hiệu lực</p>
        </div>
      </section>

      <section aria-labelledby="settings-readiness-heading">
        <div className="mb-3 flex items-start gap-3">
          <div className="rounded-md bg-[var(--accent-soft)] p-2 text-[var(--accent)]">
            <SlidersHorizontal size={18} aria-hidden="true" />
          </div>
          <div>
            <h2 id="settings-readiness-heading" className="text-lg font-bold">Readiness cấu hình</h2>
            <p className="mt-1 text-[13px] text-[var(--text-muted)]">
              Trạng thái lấy từ cấu hình hiệu lực hiện tại. Những domain chưa lưu kết quả kiểm tra kết nối sẽ không được mô tả là “đã test”.
            </p>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {data.items.map((entry) => {
            const status = STATUS_STYLE[entry.status];
            const Icon = status.icon;
            return (
              <Link
                key={entry.id}
                href={entry.href}
                className="group flex min-h-40 flex-col rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-5 transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-bold">{entry.label}</h3>
                    <p className="mt-1 text-sm font-semibold text-[var(--text-secondary)]">{entry.summary}</p>
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${status.className}`}>
                    <Icon size={13} weight="fill" aria-hidden="true" />
                    {entry.statusLabel}
                  </span>
                </div>
                <p className="mt-3 text-xs leading-5 text-[var(--text-muted)]">{entry.detail}</p>
                <div className="mt-auto flex items-center justify-between gap-3 pt-4 text-xs">
                  <span className="text-[var(--text-muted)]">Nguồn: {entry.source}</span>
                  <span className="inline-flex items-center gap-1 font-bold text-[var(--accent)]">
                    Mở cấu hình <ArrowRight size={13} aria-hidden="true" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
