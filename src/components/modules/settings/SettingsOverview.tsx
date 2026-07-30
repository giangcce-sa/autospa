import Link from "next/link";
import {
  ArrowRight,
  CheckCircle,
  Info,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react/dist/ssr";
import { DashboardMetric, DashboardPanel, DashboardStatusStrip } from "@/components/dashboard/Dashboard";
import type { SettingsOverviewData, SettingsOverviewStatus } from "@/lib/settings/overview-policy";

const STATUS_STYLE: Record<SettingsOverviewStatus, { icon: typeof CheckCircle; className: string }> = {
  ready: { icon: CheckCircle, className: "bg-[var(--success-light)] text-[var(--success)]" },
  attention: { icon: WarningCircle, className: "bg-[var(--amber-light)] text-[var(--amber)]" },
  blocked: { icon: XCircle, className: "bg-[var(--danger-light)] text-[var(--danger)]" },
  info: { icon: Info, className: "bg-[var(--info-light)] text-[var(--info)]" },
};

const SETTINGS_GROUPS = [
  { title: "Kết nối", views: ["connections", "channels"] },
  { title: "AI & Media", views: ["providers", "images", "video"] },
  { title: "Vận hành", views: ["ads", "automation"] },
  { title: "Dữ liệu & Bảo mật", views: ["data", "security"] },
] as const;

export function SettingsOverview({ data }: { data: SettingsOverviewData }) {
  return (
    <div className="space-y-5">
      <DashboardStatusStrip
        tone={data.blockedCount ? "danger" : data.attentionCount ? "warning" : "success"}
        title={data.blockedCount ? `${data.blockedCount} safety blocker đang hiệu lực` : data.attentionCount ? `${data.attentionCount} domain cần chú ý` : "Cấu hình không có blocker"}
        detail="Trạng thái lấy từ cấu hình hiệu lực. Domain chưa persist kết quả probe không được mô tả là “đã test” hoặc đã kiểm tra kết nối."
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <DashboardMetric label="Domain sẵn sàng" value={data.readyCount} detail="Có cấu hình khả dụng" tone="success" />
        <DashboardMetric label="Cần chú ý" value={data.attentionCount} detail="Chưa hoàn tất hoặc mô phỏng" tone="warning" />
        <DashboardMetric label="Safety blocker" value={data.blockedCount} detail="Đang chặn execution" tone={data.blockedCount ? "danger" : "success"} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {SETTINGS_GROUPS.map((group) => {
          const entries = data.items.filter((entry) => group.views.some((view) => entry.href.includes(`view=${view}`)));
          return (
            <DashboardPanel key={group.title} title={group.title} description={`${entries.length} domain cấu hình`} padding={false}>
              {entries.map((entry) => {
                const status = STATUS_STYLE[entry.status];
                const Icon = status.icon;
                return (
                  <Link key={entry.id} href={entry.href} className="row-hover grid gap-3 border-b border-[var(--border)] px-4 py-4 last:border-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold">{entry.label}</h3><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${status.className}`}><Icon size={12} weight="fill" aria-hidden="true" />{entry.statusLabel}</span></div>
                      <p className="mt-1 text-xs font-semibold text-[var(--text-secondary)]">{entry.summary}</p>
                      <p className="mt-1 text-[11px] leading-5 text-[var(--text-muted)]">{entry.detail}</p>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-[11px] sm:flex-col sm:items-end sm:justify-center"><span className="text-[var(--text-muted)]">Nguồn: {entry.source}</span><span className="inline-flex items-center gap-1 font-bold text-[var(--accent)]">Mở cấu hình <ArrowRight size={13} aria-hidden="true" /></span></div>
                  </Link>
                );
              })}
            </DashboardPanel>
          );
        })}
      </div>
    </div>
  );
}
