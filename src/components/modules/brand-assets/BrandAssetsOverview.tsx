import Link from "next/link";
import { ArrowRight, BookOpenText, Brain, CheckCircle, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { DashboardMetric, DashboardPanel, DashboardStatusStrip } from "@/components/dashboard/Dashboard";
import type { BrandAssetsOverviewData } from "@/lib/brand-assets-overview";
import { BRAND_ASSET_AREAS, getBrandAssetsReadiness } from "@/lib/brand-assets-readiness";

function dateLabel(value: Date | null) {
  return value
    ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(value)
    : "Chưa có dữ liệu";
}

export function BrandAssetsOverview({ data }: { data: BrandAssetsOverviewData }) {
  const readiness = data.pages.map((page) => getBrandAssetsReadiness(page));
  const fullyReadyPages = readiness.filter((score) => score.complete === score.total).length;
  const readyChecks = readiness.reduce((sum, score) => sum + score.complete, 0);
  const totalChecks = readiness.reduce((sum, score) => sum + score.total, 0);

  return (
    <div className="space-y-5">
      <DashboardStatusStrip
        tone={!data.pages.length ? "warning" : fullyReadyPages === data.pages.length ? "success" : "warning"}
        title={!data.pages.length ? "Chưa có Facebook Page khả dụng" : fullyReadyPages === data.pages.length ? "Brand assets đã sẵn sàng cho mọi Page" : "Một số Page cần bổ sung tài nguyên"}
        detail={data.canMutate ? "Owner có thể cập nhật tài nguyên; Creative chỉ dùng dữ liệu và consent thuộc đúng Page." : "Chế độ chỉ xem. Creative chỉ dùng dữ liệu và consent thuộc đúng Page."}
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardMetric label="Page sẵn sàng" value={`${fullyReadyPages}/${data.pages.length}`} detail={`${readyChecks}/${totalChecks} readiness checks`} tone={fullyReadyPages === data.pages.length && data.pages.length ? "success" : "warning"} />
        <DashboardMetric label="Kiến thức thương hiệu" value={data.brandItemCount} detail={`Cập nhật ${dateLabel(data.brandUpdatedAt)}`} icon={BookOpenText} href="/system/brand-assets?view=brand&scope=account" />
        <DashboardMetric label="Insight đã học" value={data.learningInsightCount} detail={`Mới nhất ${dateLabel(data.learningUpdatedAt)}`} icon={Brain} tone="accent" href="/system/brand-assets?view=learning&scope=account" />
        <DashboardMetric label="Quyền hiện tại" value={data.canMutate ? "Owner" : "Viewer"} detail={data.canMutate ? "Có thể cập nhật" : "Chỉ có quyền đọc"} tone="info" />
      </div>

      <DashboardPanel title="Readiness theo Facebook Page" description="Ma trận tài nguyên theo đúng Page scope" padding={false}>
        {data.pages.length === 0 ? (
          <div className="p-8 text-center">
            <WarningCircle size={24} className="mx-auto text-[var(--warning)]" aria-hidden="true" />
            <h3 className="mt-2 text-sm font-bold">Chưa có Facebook Page khả dụng</h3>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Kết nối Page hoặc cấp quyền Page cho tài khoản này để quản lý tài nguyên theo thương hiệu.</p>
          </div>
        ) : data.pages.map((page) => {
          const score = getBrandAssetsReadiness(page);
          return (
            <article key={page.id} className="border-b border-[var(--border)] p-4 last:border-0 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0"><h3 className="truncate text-[15px] font-bold">{page.pageName}</h3><p className="mt-1 text-xs text-[var(--text-muted)]">{page.isActive ? "Đang hoạt động" : "Đang tạm ngưng"} · {page.serviceCount} dịch vụ · {page.consentedStaffCount}/{page.staffCount} nhân viên consent</p></div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${score.complete === score.total ? "bg-[var(--success-light)] text-[var(--success)]" : "bg-[var(--warning-light)] text-[var(--warning)]"}`}>{score.complete}/{score.total} sẵn sàng</span>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {BRAND_ASSET_AREAS.map((area) => {
                  const ready = area.ready(page);
                  return (
                    <Link key={area.view} href={`/system/brand-assets?view=${area.view}&scope=current&pageId=${encodeURIComponent(page.id)}`} className="row-hover flex min-h-11 items-center justify-between gap-2 rounded-[9px] border border-[var(--border)] bg-[var(--bg-subtle)] px-3 text-xs font-semibold">
                      <span className="flex items-center gap-2">{ready ? <CheckCircle size={14} weight="fill" className="text-[var(--success)]" /> : <WarningCircle size={14} className="text-[var(--warning)]" />}{area.label}</span>
                      <ArrowRight size={13} className="text-[var(--text-muted)]" aria-hidden="true" />
                    </Link>
                  );
                })}
              </div>
              <p className="mt-3 text-[11px] text-[var(--text-muted)]">{page.storyCount} câu chuyện · {page.approvedStyleSampleCount} bài mẫu đã duyệt</p>
            </article>
          );
        })}
      </DashboardPanel>
    </div>
  );
}
