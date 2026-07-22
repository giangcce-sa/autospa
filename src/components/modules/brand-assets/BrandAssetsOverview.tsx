import Link from "next/link";
import { ArrowRight, BookOpenText, Brain, CheckCircle, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import type { BrandAssetsOverviewData, BrandAssetsPageReadiness } from "@/lib/brand-assets-overview";

function dateLabel(value: Date | null) {
  return value
    ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(value)
    : "Chưa có dữ liệu";
}

function readiness(page: BrandAssetsPageReadiness) {
  const checks = [
    page.hasBrandKit,
    page.serviceCount > 0,
    page.consentedStaffCount > 0,
    page.storyCount > 0,
    page.approvedStyleSampleCount >= 3 && page.hasStyleProfile,
  ];
  return { complete: checks.filter(Boolean).length, total: checks.length };
}

const PAGE_AREAS = [
  { view: "kit", label: "Bộ nhận diện", ready: (page: BrandAssetsPageReadiness) => page.hasBrandKit },
  { view: "services", label: "Dịch vụ", ready: (page: BrandAssetsPageReadiness) => page.serviceCount > 0 },
  { view: "staff", label: "Nhân viên & consent", ready: (page: BrandAssetsPageReadiness) => page.consentedStaffCount > 0 },
  { view: "stories", label: "Câu chuyện", ready: (page: BrandAssetsPageReadiness) => page.storyCount > 0 },
  { view: "style", label: "Văn phong", ready: (page: BrandAssetsPageReadiness) => page.approvedStyleSampleCount >= 3 && page.hasStyleProfile },
] as const;

export function BrandAssetsOverview({ data }: { data: BrandAssetsOverviewData }) {
  return (
    <div className="space-y-4">
      <section className="grid gap-px overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--border)] sm:grid-cols-2">
        <Link href="/system/brand-assets?view=brand&scope=account" className="bg-[var(--bg-card)] p-5 hover:bg-[var(--accent-soft)]">
          <BookOpenText size={20} className="text-[var(--accent)]" aria-hidden="true" />
          <p className="mt-3 text-2xl font-extrabold tabular-nums">{data.brandItemCount}</p>
          <h2 className="mt-1 text-sm font-bold">Kiến thức thương hiệu</h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Cập nhật: {dateLabel(data.brandUpdatedAt)}</p>
        </Link>
        <Link href="/system/brand-assets?view=learning&scope=account" className="bg-[var(--bg-card)] p-5 hover:bg-[var(--accent-soft)]">
          <Brain size={20} className="text-[var(--premium)]" aria-hidden="true" />
          <p className="mt-3 text-2xl font-extrabold tabular-nums">{data.learningInsightCount}</p>
          <h2 className="mt-1 text-sm font-bold">Insight hệ thống đã học</h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Mới nhất: {dateLabel(data.learningUpdatedAt)}</p>
        </Link>
      </section>

      <section aria-labelledby="page-readiness-heading">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="page-readiness-heading" className="text-lg font-bold">Readiness theo Facebook Page</h2>
            <p className="mt-1 text-[13px] text-[var(--text-muted)]">Creative workspace chỉ dùng tài nguyên đã cấu hình cho đúng Page.</p>
          </div>
          {!data.canMutate && <span className="rounded-full bg-[var(--bg-subtle)] px-3 py-1 text-xs font-semibold text-[var(--text-muted)]">Chế độ chỉ xem</span>}
        </div>

        {data.pages.length === 0 ? (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-6 text-center">
            <WarningCircle size={24} className="mx-auto text-[var(--amber)]" aria-hidden="true" />
            <h3 className="mt-2 text-sm font-bold">Chưa có Facebook Page khả dụng</h3>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Kết nối Page hoặc cấp quyền Page cho tài khoản này để quản lý tài nguyên theo thương hiệu.</p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {data.pages.map((page) => {
              const score = readiness(page);
              return (
                <article key={page.id} className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-[15px] font-bold">{page.pageName}</h3>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">{page.isActive ? "Đang hoạt động" : "Đang tạm ngưng"}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${score.complete === score.total ? "bg-[var(--success-light)] text-[var(--success)]" : "bg-[var(--amber-light)] text-[var(--amber)]"}`}>
                      {score.complete}/{score.total} sẵn sàng
                    </span>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {PAGE_AREAS.map((area) => {
                      const ready = area.ready(page);
                      return (
                        <Link
                          key={area.view}
                          href={`/system/brand-assets?view=${area.view}&scope=current&pageId=${encodeURIComponent(page.id)}`}
                          className="flex min-h-11 items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-[var(--bg-subtle)] px-3 text-xs font-semibold"
                        >
                          <span className="flex items-center gap-2">
                            {ready ? <CheckCircle size={14} weight="fill" className="text-[var(--success)]" /> : <WarningCircle size={14} className="text-[var(--amber)]" />}
                            {area.label}
                          </span>
                          <ArrowRight size={13} className="text-[var(--text-muted)]" aria-hidden="true" />
                        </Link>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-[11px] text-[var(--text-muted)]">
                    {page.serviceCount} dịch vụ · {page.staffCount} nhân viên ({page.consentedStaffCount} consent) · {page.storyCount} câu chuyện · {page.approvedStyleSampleCount} bài mẫu
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
