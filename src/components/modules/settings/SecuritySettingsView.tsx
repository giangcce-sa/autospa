import Link from "next/link";
import {
  CheckCircle,
  ClockCounterClockwise,
  Key,
  ShieldCheck,
  UserCircle,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
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
      <section className="grid gap-px overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--border)] sm:grid-cols-3">
        <div className="bg-[var(--bg-card)] p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Secret đã cấu hình</p>
          <p className="mt-2 text-3xl font-extrabold tabular-nums text-[var(--success)]">
            {data.configuredSecretCount}/{data.secrets.length}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">chỉ hiển thị trạng thái, không trả giá trị</p>
        </div>
        <div className="bg-[var(--bg-card)] p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Deployment readiness</p>
          <p className="mt-2 text-3xl font-extrabold tabular-nums text-[var(--accent)]">
            {data.deploymentReadyCount}/{data.deployment.length}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">auth, cron, HTTPS origin và storage</p>
        </div>
        <div className="bg-[var(--bg-card)] p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Người dùng</p>
          <p className="mt-2 text-3xl font-extrabold tabular-nums">{data.users.length}</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{data.pageAccessCount} phân quyền Page đã lưu</p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-5">
          <div className="flex items-start gap-3">
            <Key size={19} className="mt-0.5 text-[var(--accent)]" aria-hidden="true" />
            <div>
              <h2 className="text-lg font-bold">Trạng thái secret</h2>
              <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                AutoSpa không hiển thị raw secret hoặc suffix tại màn hình tổng hợp này.
              </p>
            </div>
          </div>
          <div className="mt-4 divide-y divide-[var(--border)]">
            {data.secrets.map((entry) => (
              <div key={entry.id} className="flex min-h-12 items-center justify-between gap-3 py-2.5">
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
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-5">
            <div className="flex items-start gap-3">
              <ShieldCheck size={19} className="mt-0.5 text-[var(--premium)]" aria-hidden="true" />
              <div>
                <h2 className="text-lg font-bold">Deployment security</h2>
                <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                  Các giá trị này chỉ có thể thay đổi tại môi trường triển khai, không chỉnh từ database.
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
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
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-5">
            <div className="flex items-start gap-3">
              <UserCircle size={19} className="mt-0.5 text-[var(--accent)]" aria-hidden="true" />
              <div>
                <h2 className="text-lg font-bold">Tài khoản & phiên đăng nhập</h2>
                <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                  Auth.js đang dùng JWT; hệ thống không có bảng session để tuyên bố số phiên đang hoạt động.
                </p>
              </div>
            </div>
            <div className="mt-4 divide-y divide-[var(--border)]">
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
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-5" aria-labelledby="settings-audit-heading">
        <div className="flex items-start gap-3">
          <ClockCounterClockwise size={19} className="mt-0.5 text-[var(--accent)]" aria-hidden="true" />
          <div>
            <h2 id="settings-audit-heading" className="text-lg font-bold">Audit cấu hình gần đây</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
              Chỉ hiển thị tiêu đề, nguồn và thời gian. Metadata có thể chứa user ID hoặc field names không được truyền tới UI này.
            </p>
          </div>
        </div>
        {data.audits.length ? (
          <div className="mt-4 divide-y divide-[var(--border)]">
            {data.audits.map((audit) => (
              <div key={audit.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-bold">{audit.title}</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{audit.detail || "Không có mô tả"} · {audit.source}</p>
                </div>
                <div className="flex items-center gap-3">
                  <time className="text-xs text-[var(--text-muted)]" dateTime={audit.createdAt}>{dateLabel(audit.createdAt)}</time>
                  {audit.href ? (
                    <Link href={audit.href} className="inline-flex min-h-11 items-center text-xs font-bold text-[var(--accent)]">Mở</Link>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-md bg-[var(--bg-subtle)] p-4 text-sm text-[var(--text-muted)]">Chưa có audit thay đổi Settings.</p>
        )}
      </section>
    </div>
  );
}
