import Link from "next/link";
import { ChartLineUp, CheckCircle, Megaphone, Pulse, Sparkle, Target, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { DashboardAction, DashboardHeader, DashboardMetric, DashboardPage, DashboardPanel, DashboardStatusStrip } from "@/components/dashboard/Dashboard";
import { DashboardTabPanel, DashboardTabs } from "@/components/dashboard/DashboardTabs";
import type { GrowthOverviewData } from "@/lib/growth-overview";
import type { WorkspaceAccess } from "@/lib/workspace-access";

export function GrowthOverview({ data, access }: { data: GrowthOverviewData; access: WorkspaceAccess }) {
  const performance = data.performance;
  const pageParams = access.state.pageId ? `&pageId=${encodeURIComponent(access.state.pageId)}` : "";
  const scopeParams = `scope=${access.state.scope}${pageParams}`;
  const measured = performance.totals.measured > 0;
  const adsReady = data.ads.pages.length > 0 && data.ads.readyPages === data.ads.pages.length;

  return (
    <DashboardPage>
      <DashboardHeader
        eyebrow="Growth Intelligence"
        title="Trung tâm tăng trưởng"
        description="Theo dõi hiệu quả nội dung, Ads readiness, ưu đãi và tín hiệu thị trường từ dữ liệu persisted trong đúng phạm vi Facebook Page."
        meta={`Nguồn tổng hợp nội bộ · đọc lúc ${formatTime(data.asOf)} · không gọi Meta hoặc AI provider`}
        actions={<><DashboardAction href={`/growth/ads?view=overview&scope=current${pageParams}`}>Mở Ads Manager</DashboardAction><DashboardAction href={`/growth/intelligence?view=reports&${scopeParams}`} secondary>Xem báo cáo</DashboardAction></>}
        controls={<GrowthScopeControl access={access} />}
      />

      <DashboardStatusStrip
        tone={performance.provenance.availability === "available" ? "success" : "warning"}
        title={performance.provenance.availability === "available" ? "Analytics nội dung khả dụng" : performance.provenance.availability === "partial" ? "Analytics nội dung chưa đầy đủ" : "Chưa có analytics nội dung"}
        detail={performance.provenance.warning ?? `${performance.totals.measured}/${performance.totals.published} bài published đã có analytics.`}
        meta={`Nguồn: ${performance.provenance.source} · ${performance.provenance.window} · cập nhật ${formatTime(performance.provenance.asOf)}`}
        action={{ href: `/growth/intelligence?view=performance&${scopeParams}`, label: "Xem provenance" }}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <DashboardMetric label="Post đã đăng" value={performance.totals.published} detail={`${performance.totals.posts} post persisted`} icon={Megaphone} href={`/growth/intelligence?view=reports&${scopeParams}`} />
        <DashboardMetric label="Có analytics" value={performance.totals.measured} detail={formatCompleteness(performance.provenance.completeness)} icon={Pulse} tone={measured ? "success" : "warning"} />
        <DashboardMetric label="Tiếp cận" value={formatMetric(performance.totals.reach)} detail="Không suy diễn khi chưa đo" icon={ChartLineUp} unavailable={performance.totals.reach == null} />
        <DashboardMetric label="Tỷ lệ tương tác" value={performance.totals.engagementRate == null ? "Chưa đo" : `${performance.totals.engagementRate}%`} detail="Từ reach + engagement persisted" icon={Target} unavailable={performance.totals.engagementRate == null} />
        <DashboardMetric label="Ads Page ready" value={`${data.ads.readyPages}/${data.ads.pages.length}`} detail={`${data.ads.failedOperations} operation lỗi gần đây`} icon={CheckCircle} tone={adsReady ? "success" : "warning"} href={`/growth/ads?view=overview&scope=current${pageParams}`} />
        <DashboardMetric label="Cảnh báo ưu tiên" value={data.market.urgentAlerts} detail={`${data.market.unreadAlerts} cảnh báo chưa đọc`} icon={WarningCircle} tone={data.market.urgentAlerts ? "danger" : "info"} href="/growth/intelligence?view=listening&scope=account" />
      </div>

      <DashboardTabs items={[{ id: "overview", label: "Tổng quan" }, { id: "performance", label: "Hiệu quả" }, { id: "opportunity", label: "Cơ hội" }]}>
        <DashboardTabPanel id="overview" className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.85fr)]">
          <ContentPerformance data={data} scopeParams={scopeParams} />
          <AdsReadiness data={data} pageParams={pageParams} />
        </DashboardTabPanel>

        <DashboardTabPanel id="performance" className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]">
          <ChannelTable data={data} />
          <RecentOperations data={data} pageParams={pageParams} />
        </DashboardTabPanel>

        <DashboardTabPanel id="opportunity" className="grid gap-5 xl:grid-cols-3">
          <PromotionPanel data={data} />
          <MarketPanel data={data} />
          <RecommendationPanel data={data} pageParams={pageParams} />
        </DashboardTabPanel>
      </DashboardTabs>
    </DashboardPage>
  );
}

function GrowthScopeControl({ access }: { access: WorkspaceAccess }) {
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Phạm vi dữ liệu tăng trưởng">
      <Link href="/growth?scope=all" aria-current={access.state.scope === "all" ? "page" : undefined} className={scopeClass(access.state.scope === "all")}>Tất cả Trang</Link>
      {access.pages.map((page) => (
        <Link key={page.id} href={`/growth?scope=current&pageId=${encodeURIComponent(page.id)}`} aria-current={access.state.pageId === page.id ? "page" : undefined} className={scopeClass(access.state.pageId === page.id)}>{page.pageName}</Link>
      ))}
    </div>
  );
}

function ContentPerformance({ data, scopeParams }: { data: GrowthOverviewData; scopeParams: string }) {
  return (
    <DashboardPanel title="Nội dung tạo tăng trưởng" description="Top Post theo lượt thích trong phạm vi đã chọn" action={{ href: `/growth/intelligence?view=performance&${scopeParams}`, label: "Xem tất cả" }} padding={false}>
      {data.performance.topPosts.length ? data.performance.topPosts.map((post, index) => (
        <article key={post.id} className="grid gap-3 border-b border-[var(--border)] px-4 py-4 last:border-0 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:px-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-light)] text-xs font-extrabold text-[var(--accent)]">{index + 1}</span>
          <div className="min-w-0"><p className="line-clamp-2 text-sm font-bold leading-5">{post.caption}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{post.pageName} · {post.platform} · {post.status}</p></div>
          <div className="text-left text-xs text-[var(--text-muted)] sm:text-right">{post.analytics ? <><strong className="block text-sm text-[var(--text)]">{post.analytics.reach.toLocaleString("vi-VN")}</strong><span>reach · {post.analytics.likes} like</span></> : "Chưa có analytics"}</div>
        </article>
      )) : <Empty message="Không có Post có analytics trong phạm vi." />}
    </DashboardPanel>
  );
}

function AdsReadiness({ data, pageParams }: { data: GrowthOverviewData; pageParams: string }) {
  return (
    <DashboardPanel title="Ads readiness" description="Safety gate theo từng Facebook Page" badge={{ label: `${data.ads.readyPages}/${data.ads.pages.length} ready`, variant: data.ads.readyPages === data.ads.pages.length && data.ads.pages.length ? "success" : "warning" }} action={{ href: `/growth/ads?view=overview&scope=current${pageParams}`, label: "Mở Ads" }} padding={false}>
      {data.ads.pages.length ? data.ads.pages.map((page) => {
        const ready = Boolean(page.adAccountId && page.adsReadinessStatus === "ready" && !page.adsReadinessError);
        return <article key={page.id} className="border-b border-[var(--border)] px-4 py-4 last:border-0 sm:px-5"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-bold">{page.pageName}</h3><p className="mt-1 text-xs text-[var(--text-muted)]">{page.adAccountId ?? "Chưa cấu hình Ad Account"}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${ready ? "bg-[var(--success-light)] text-[var(--success)]" : "bg-[var(--warning-light)] text-[var(--warning)]"}`}>{ready ? "Sẵn sàng" : "Cần xử lý"}</span></div>{page.adsReadinessError ? <p className="mt-2 text-xs leading-5 text-[var(--warning)]">{page.adsReadinessError}</p> : null}</article>;
      }) : <Empty message={data.ads.warning ?? "Chưa có Page để đánh giá."} />}
    </DashboardPanel>
  );
}

function ChannelTable({ data }: { data: GrowthOverviewData }) {
  const rows = [
    { channel: "Nội dung Facebook", status: data.performance.provenance.availability, records: data.performance.totals.measured, detail: formatMetric(data.performance.totals.reach), label: "reach" },
    { channel: "Meta Ads operations", status: data.ads.availability, records: data.ads.operations.length, detail: String(data.ads.failedOperations), label: "lỗi" },
    { channel: "Khuyến mãi", status: data.promotions.availability, records: data.promotions.total, detail: String(data.promotions.active), label: "active" },
    { channel: "Market intelligence", status: data.market.availability, records: data.market.activeCompetitors, detail: String(data.market.unreadAlerts), label: "alert" },
  ];
  return <DashboardPanel title="Kênh và nguồn dữ liệu" description="Availability được giữ riêng với số 0" padding={false}><div className="overflow-x-auto"><table><thead><tr><th>Kênh</th><th>Trạng thái</th><th>Records</th><th>Tín hiệu</th></tr></thead><tbody>{rows.map((row) => <tr key={row.channel}><td className="text-sm font-bold">{row.channel}</td><td><span className={`text-xs font-bold ${row.status === "available" ? "text-[var(--success)]" : "text-[var(--warning)]"}`}>{row.status}</span></td><td className="text-sm tabular-nums">{row.records}</td><td className="text-sm"><strong>{row.detail}</strong> <span className="text-xs text-[var(--text-muted)]">{row.label}</span></td></tr>)}</tbody></table></div></DashboardPanel>;
}

function RecentOperations({ data, pageParams }: { data: GrowthOverviewData; pageParams: string }) {
  return <DashboardPanel title="Ads operations gần đây" description="Checkpoint persisted, không phải live provider state" action={{ href: `/growth/ads?view=operations&scope=current${pageParams}`, label: "Mở vận hành" }} padding={false}>{data.ads.operations.length ? data.ads.operations.slice(0, 6).map((operation) => <article key={operation.id} className="border-b border-[var(--border)] px-4 py-3 last:border-0 sm:px-5"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-bold">{operation.pageName}</p><p className="mt-1 truncate font-mono text-[10px] text-[var(--text-muted)]">{operation.id}</p></div><span className={`text-xs font-bold ${operation.status === "failed" ? "text-[var(--danger)]" : "text-[var(--text-secondary)]"}`}>{operation.status}</span></div><p className="mt-2 text-xs text-[var(--text-muted)]">{operation.currentStep} · {formatTime(operation.updatedAt)}</p></article>) : <Empty message="Chưa có AdsCreateOperation." />}</DashboardPanel>;
}

function PromotionPanel({ data }: { data: GrowthOverviewData }) {
  return <DashboardPanel title="Cơ hội ưu đãi" description="Post khuyến mãi và capacity estimate" badge={{ label: data.promotions.capacity.availability, variant: "warning" }} action={{ href: "/growth/promotions?view=overview&scope=account", label: "Mở khuyến mãi" }}><div className="grid grid-cols-2 gap-3"><SmallMetric label="Post gần đây" value={data.promotions.total} /><SmallMetric label="Đang hoạt động" value={data.promotions.active} /><SmallMetric label="Khoảng trống 48h" value={data.promotions.capacity.gaps.length} /><SmallMetric label="Mức tin cậy" value="Ước tính" /></div><p className="mt-4 text-xs leading-5 text-[var(--warning)]">{data.promotions.capacity.warning}</p></DashboardPanel>;
}

function MarketPanel({ data }: { data: GrowthOverviewData }) {
  return <DashboardPanel title="Tín hiệu thị trường" description={data.market.window} action={{ href: "/growth/intelligence?view=listening&scope=account", label: "Xem cảnh báo" }}><div className="grid grid-cols-2 gap-3"><SmallMetric label="Đối thủ active" value={data.market.activeCompetitors} /><SmallMetric label="Bài đối thủ 7 ngày" value={data.market.competitorPosts} /><SmallMetric label="Alert chưa đọc" value={data.market.unreadAlerts} /><SmallMetric label="Critical / High" value={data.market.urgentAlerts} /></div>{data.market.warning ? <p className="mt-4 text-xs leading-5 text-[var(--warning)]">{data.market.warning}</p> : null}</DashboardPanel>;
}

function RecommendationPanel({ data, pageParams }: { data: GrowthOverviewData; pageParams: string }) {
  const recommendation = data.ads.readyPages < data.ads.pages.length
    ? { title: "Hoàn tất Ads readiness", detail: "Có Page chưa vượt qua safety gate. Kiểm tra blocker trước khi tạo resource.", href: "/system/settings?view=ads&scope=account" }
    : data.performance.provenance.availability !== "available"
      ? { title: "Bổ sung analytics", detail: "Dữ liệu nội dung chưa đủ để đọc xu hướng tin cậy.", href: `/growth/intelligence?view=reports&scope=${data.scope}${pageParams}` }
      : data.market.urgentAlerts > 0
        ? { title: "Xử lý cảnh báo ưu tiên", detail: "Có SocialAlert critical/high chưa đọc trong dữ liệu persisted.", href: "/growth/intelligence?view=listening&scope=account" }
        : { title: "Duy trì nhịp tăng trưởng", detail: "Không có blocker ưu tiên từ các nguồn persisted hiện tại.", href: `/growth/intelligence?view=performance&scope=${data.scope}${pageParams}` };
  return <DashboardPanel title="Ưu tiên tiếp theo" description="Rule-based từ blocker và freshness thật" badge={{ label: "Không phải AI", variant: "neutral" }}><div className="flex h-10 w-10 items-center justify-center rounded-[11px] bg-[var(--accent-light)] text-[var(--accent)]"><Sparkle size={20} weight="fill" /></div><h3 className="mt-4 text-lg font-extrabold">{recommendation.title}</h3><p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{recommendation.detail}</p><Link href={recommendation.href} className="mt-5 inline-flex min-h-11 items-center text-sm font-bold text-[var(--accent)]">Thực hiện ưu tiên</Link></DashboardPanel>;
}

function SmallMetric({ label, value }: { label: string; value: string | number }) { return <div className="rounded-[9px] bg-[var(--bg-subtle)] p-3"><p className="text-lg font-extrabold tabular-nums">{typeof value === "number" ? value.toLocaleString("vi-VN") : value}</p><p className="mt-1 text-[11px] text-[var(--text-muted)]">{label}</p></div>; }
function Empty({ message }: { message: string }) { return <p className="p-8 text-center text-sm leading-6 text-[var(--text-muted)]">{message}</p>; }
function scopeClass(active: boolean) { return `inline-flex min-h-9 items-center rounded-[8px] px-3 text-xs font-bold ${active ? "bg-[var(--accent)] text-white" : "border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)]"}`; }
function formatMetric(value: number | null) { return value == null ? "Chưa đo" : value.toLocaleString("vi-VN"); }
function formatCompleteness(value: number | null) { return value == null ? "Chưa xác định độ đầy đủ" : `${Math.round(value * 100)}% dữ liệu đầy đủ`; }
function formatTime(value: string | number) { return new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }); }
