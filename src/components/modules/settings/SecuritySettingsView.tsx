import Link from "next/link";
import {
  CheckCircle,
  Key,
  ShieldCheck,
  UserCircle,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import { DashboardMetric, DashboardPanel } from "@/components/dashboard/Dashboard";
import { actionStyles } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import type { SecuritySettingsDto } from "@/lib/settings/security";

const SOURCE_LABEL = {
  database: "Database",
  deployment: "Deployment",
  database_or_deployment: "Database hoặc deployment",
} as const;

function dateLabel(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "Chưa ghi nhận";
}

export function SecuritySettingsView({ data }: { data: SecuritySettingsDto }) {
  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-3">
        <DashboardMetric
          label="Secret đã cấu hình"
          value={`${data.configuredSecretCount}/${data.secrets.length}`}
          detail="Chỉ hiển thị trạng thái, không trả giá trị"
          icon={Key}
          tone="success"
        />
        <DashboardMetric
          label="Deployment readiness"
          value={`${data.deploymentReadyCount}/${data.deployment.length}`}
          detail="Auth, cron, HTTPS origin và storage"
          icon={ShieldCheck}
          tone="info"
        />
        <DashboardMetric
          label="Người dùng"
          value={data.users.length}
          detail={`${data.pageAccessCount} phân quyền Page đã lưu`}
          icon={UserCircle}
        />
      </section>

      <section className="grid items-start gap-4 xl:grid-cols-2">
        <DashboardPanel
          title="Trạng thái secret"
          description="AutoSpa không hiển thị raw secret hoặc suffix tại màn hình tổng hợp này."
        >
          <div className="divide-y divide-[var(--border)]">
            {data.secrets.map((entry) => (
              <div key={entry.id} className="flex min-h-12 items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-semibold">{entry.label}</p>
                  <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">Nguồn: {SOURCE_LABEL[entry.source]}</p>
                </div>
                <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${entry.configured ? "bg-[var(--success-light)] text-[var(--success)]" : "bg-[var(--bg-subtle)] text-[var(--text-muted)]"}`}>
                  {entry.configured ? <CheckCircle size={13} weight="fill" aria-hidden="true" /> : <WarningCircle size={13} aria-hidden="true" />}
                  {entry.configured ? "Đã cấu hình" : "Chưa cấu hình"}
                </span>
              </div>
            ))}
          </div>
        </DashboardPanel>

        <div className="space-y-4">
          <DashboardPanel
            title="Deployment security"
            description="Các giá trị này chỉ có thể thay đổi tại môi trường triển khai, không chỉnh từ database."
          >
            <div className="space-y-2">
              {data.deployment.map((entry) => (
                <div key={entry.id} className="rounded-md border border-[var(--border)] bg-[var(--bg-subtle)] p-3">
                  <div className="flex items-center gap-2">
                    {entry.configured ? (
                      <CheckCircle size={15} weight="fill" className="text-[var(--success)]" aria-hidden="true" />
                    ) : (
                      <WarningCircle size={15} className="text-[var(--amber)]" aria-hidden="true" />
                    )}
                    <p className="text-sm font-bold">{entry.label}</p>
                  </div>
                  <p className="mt-1 pl-[23px] text-xs leading-5 text-[var(--text-muted)]">{entry.detail}</p>
                </div>
              ))}
            </div>
          </DashboardPanel>

          <DashboardPanel
            title="Tài khoản & phiên đăng nhập"
            description="Auth.js đang dùng JWT; hệ thống không có bảng session để tuyên bố số phiên đang hoạt động."
          >
            <div className="divide-y divide-[var(--border)]">
              {data.users.map((user) => (
                <div key={user.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold">{user.name || user.email}</p>
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">{user.email}</p>
                    </div>
                    <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-1 text-xs font-bold text-[var(--text-secondary)]">
                      {user.role === "owner" ? "Owner" : "Viewer"}
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] text-[var(--text-muted)]">Đăng nhập gần nhất: {dateLabel(user.lastLoginAt)}</p>
                </div>
              ))}
            </div>
          </DashboardPanel>
        </div>
      </section>

      <DashboardPanel
        title="Audit cấu hình gần đây"
        description="Chỉ hiển thị tiêu đề, nguồn và thời gian. Metadata có thể chứa user ID hoặc field names không được truyền tới UI này."
      >
        {data.audits.length ? (
          <div className="divide-y divide-[var(--border)]">
            {data.audits.map((audit) => (
              <div key={audit.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-bold">{audit.title}</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{audit.detail || "Không có mô tả"} · {audit.source}</p>
                </div>
                <div className="flex items-center gap-2">
                  <time className="text-xs text-[var(--text-muted)]" dateTime={audit.createdAt}>{dateLabel(audit.createdAt)}</time>
                  {audit.href ? <Link href={audit.href} className={actionStyles({ variant: "quiet", size: "sm" })}>Mở</Link> : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState density="compact" title="Chưa có audit thay đổi Settings" />
        )}
      </DashboardPanel>
    </div>
  );
}
