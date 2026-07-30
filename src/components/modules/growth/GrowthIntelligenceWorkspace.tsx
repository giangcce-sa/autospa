import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { DashboardMetric, DashboardStatusStrip } from "@/components/dashboard/Dashboard";
import { WorkspacePermissionState } from "@/components/workspace/WorkspacePermissionState";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { ROUTES_BY_ID } from "@/config/routes";
import {
  getCompetitorIntelligence,
  getIntelligencePerformance,
  getListeningIntelligence,
  type CompetitorIntelligenceData,
  type IntelligencePerformanceData,
  type IntelligenceProvenance,
  type ListeningIntelligenceData,
} from "@/lib/growth-intelligence";
import { AccessError } from "@/lib/page-access";
import { resolveWorkspaceAccess } from "@/lib/workspace-access";
import { parseWorkspaceUrl, workspaceScopesForRoute } from "@/lib/workspace-url";

export interface GrowthIntelligenceWorkspaceProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function GrowthIntelligenceWorkspace({ searchParams }: GrowthIntelligenceWorkspaceProps) {
  const route = ROUTES_BY_ID.get("growth-intelligence");
  if (!route || route.kind !== "workspace" || !route.views?.length || !route.defaultView) notFound();

  const params = await searchParams;
  const requestedView = typeof params.view === "string" ? params.view : route.defaultView;
  const currentView = route.views.find((view) => view.id === requestedView) ?? route.views[0];
  const effectiveScope = currentView.scope ?? route.scope;
  const allowedScopes = workspaceScopesForRoute(effectiveScope);
  const state = parseWorkspaceUrl(params, {
    views: route.views.map((view) => view.id),
    defaultView: route.defaultView,
    defaultScope: allowedScopes[0],
    allowedScopes,
  });

  let access: Awaited<ReturnType<typeof resolveWorkspaceAccess>>;
  try {
    access = await resolveWorkspaceAccess(route, state, effectiveScope);
  } catch (error) {
    if (error instanceof AccessError && error.status === 403) {
      return <WorkspacePermissionState route={route} message={error.message} />;
    }
    throw error;
  }

  const pageIds = access.state.scope === "all"
    ? access.pages.map((page) => page.id)
    : access.state.pageId
      ? [access.state.pageId]
      : [];

  return (
    <WorkspaceShell route={route} state={access.state} pages={access.pages} effectiveScope={effectiveScope} dashboard>
      {currentView.id === "competitors" ? (
        <CompetitorContent data={await getCompetitorIntelligence()} canMutate={access.canMutate} />
      ) : currentView.id === "listening" ? (
        <ListeningContent data={await getListeningIntelligence()} canMutate={access.canMutate} />
      ) : pageIds.length ? (
        <PerformanceContent
          data={await getIntelligencePerformance(pageIds, access.state.scope === "all" ? "all" : "current")}
          view={currentView.id}
        />
      ) : null}
    </WorkspaceShell>
  );
}

function PerformanceContent({ data, view }: { data: IntelligencePerformanceData; view: string }) {
  const title = view === "reports" ? "Báo cáo nội dung theo Page" : view === "performance" ? "Hiệu quả nội dung" : "Tổng quan tăng trưởng";
  return (
    <section className="space-y-4">
      <DashboardStatusStrip
        tone={data.provenance.availability === "available" ? "success" : "warning"}
        title={data.provenance.availability === "available" ? "Dữ liệu analytics khả dụng" : data.provenance.availability === "partial" ? "Dữ liệu analytics chưa đầy đủ" : "Dữ liệu analytics chưa khả dụng"}
        detail={data.provenance.warning ?? "Post analytics đã sẵn sàng trong phạm vi được phép."}
        meta={`Nguồn: ${data.provenance.source} · ${data.provenance.window}`}
      />
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
          Chỉ Post có Facebook Page trong phạm vi được phép được tính. CRM, lead và doanh thu chưa có ownership tương thích nên không được ghép vào KPI này.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardMetric label="Post persisted" value={data.totals.posts} detail={`${data.totals.published} đã published`} />
        <DashboardMetric label="Có analytics" value={data.totals.measured} detail={formatCompleteness(data.provenance.completeness)} tone={data.totals.measured ? "success" : "warning"} />
        <DashboardMetric label="Tiếp cận" value={formatMetric(data.totals.reach)} detail={data.totals.likes == null ? "Like chưa đo" : `${formatMetric(data.totals.likes)} lượt thích`} unavailable={data.totals.reach == null} />
        <DashboardMetric label="Tỷ lệ tương tác" value={data.totals.engagementRate == null ? "Chưa đo" : `${data.totals.engagementRate}%`} detail={data.totals.comments == null || data.totals.shares == null ? "Engagement chưa đủ" : `${formatMetric(data.totals.comments + data.totals.shares)} bình luận + chia sẻ`} unavailable={data.totals.engagementRate == null} />
      </div>
      {view === "overview" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <WorkspaceLink href="/growth/intelligence?view=reports" title="Mở báo cáo" description="Xem KPI persisted và độ đầy đủ analytics theo Page." />
          <WorkspaceLink href="/growth/intelligence?view=performance" title="Xem hiệu quả từng Post" description="Đối chiếu Post, nguồn Page và freshness của analytics." />
          <WorkspaceLink href="/growth/intelligence?view=competitors&scope=account" title="Tín hiệu đối thủ" description="Dữ liệu cấp tài khoản, tách khỏi KPI theo Page." />
          <WorkspaceLink href="/growth/intelligence?view=listening&scope=account" title="Cảnh báo thị trường" description="Xem SocialAlert persisted và trạng thái xử lý." />
        </div>
      ) : null}
      <PostTable posts={view === "reports" ? data.topPosts : data.recentPosts} top={view === "reports"} />
    </section>
  );
}

function CompetitorContent({ data, canMutate }: { data: CompetitorIntelligenceData; canMutate: boolean }) {
  return (
    <section className="space-y-4">
      <ProvenanceNotice provenance={data.provenance} />
      <p className="rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] p-4 text-sm leading-6 text-[var(--text-secondary)]">
        Đối thủ là dữ liệu cấp tài khoản. Token không được gửi xuống workspace; {canMutate ? "owner có thể chạy tác vụ quản trị qua API được bảo vệ." : "viewer chỉ có quyền đọc."}
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Đối thủ theo dõi" value={data.competitors.length} />
        <Metric label="Đang hoạt động" value={data.competitors.filter((competitor) => competitor.isActive).length} />
        <Metric label="Bài nổi bật 7 ngày" value={data.topPosts.length} />
      </div>
      <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-card)]">
        {data.competitors.length ? data.competitors.map((competitor) => (
          <article key={competitor.id} className="grid gap-2 border-b border-[var(--border)] p-4 last:border-b-0 sm:grid-cols-[1fr_auto]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold">{competitor.name}</h3>
                <span className="rounded-full bg-[var(--bg-subtle)] px-2 py-1 text-[10px] font-semibold text-[var(--text-secondary)]">{competitor.isActive ? "active" : "paused"}</span>
              </div>
              <p className="mt-1 font-mono text-xs text-[var(--text-muted)]">{competitor.fbPageId}</p>
              {competitor.notes ? <p className="mt-2 text-sm text-[var(--text-secondary)]">{competitor.notes}</p> : null}
            </div>
            <div className="text-xs text-[var(--text-muted)] sm:text-right">
              <p>{competitor.postCount} bài persisted</p>
              <p className="mt-1">{competitor.lastFetchAt ? new Date(competitor.lastFetchAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "Chưa đồng bộ"}</p>
              <p className="mt-1">Token riêng: {competitor.hasDedicatedToken ? "đã cấu hình" : "không"}</p>
            </div>
          </article>
        )) : <p className="p-8 text-center text-sm text-[var(--text-muted)]">Chưa có đối thủ được cấu hình.</p>}
      </div>
      {data.memory ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <h2 className="text-sm font-bold">Competitor memory</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{data.memory.counterPositioning ?? "Chưa có counter-positioning persisted."}</p>
          <p className="mt-2 text-xs text-[var(--text-muted)]">{data.memory.sampleCount} mẫu · confidence {Math.round(data.memory.confidence * 100)}% · cập nhật {new Date(data.memory.updatedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</p>
        </div>
      ) : null}
      <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-card)]">
        {data.topPosts.length ? data.topPosts.map((post) => (
          <article key={post.id} className="border-b border-[var(--border)] p-4 last:border-b-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{post.competitorName}</p>
              <span className="text-xs text-[var(--text-muted)]">Score {post.engagementScore}</span>
            </div>
            <p className="mt-2 line-clamp-3 text-sm leading-6">{post.message}</p>
            <p className="mt-2 text-xs text-[var(--text-muted)]">{post.likes} like · {post.comments} bình luận · {post.shares} chia sẻ · {post.learningStatus}</p>
          </article>
        )) : <p className="p-8 text-center text-sm text-[var(--text-muted)]">Chưa có bài đối thủ trong cửa sổ 7 ngày.</p>}
      </div>
    </section>
  );
}

function ListeningContent({ data, canMutate }: { data: ListeningIntelligenceData; canMutate: boolean }) {
  return (
    <section className="space-y-4">
      <ProvenanceNotice provenance={data.provenance} />
      <p className="rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] p-4 text-sm leading-6 text-[var(--text-secondary)]">
        SocialAlert hiện là dữ liệu cấp tài khoản và không chứng minh nguồn đã được đồng bộ đầy đủ. {canMutate ? "Owner có thể phân tích hoặc cập nhật trạng thái qua mutation được bảo vệ." : "Viewer chỉ có quyền đọc."}
      </p>
      <div className="grid gap-3 sm:grid-cols-4">
        <Metric label="Tổng cảnh báo" value={data.stats.total} />
        <Metric label="Chưa đọc" value={data.stats.unread} />
        <Metric label="Critical" value={data.stats.critical} />
        <Metric label="High" value={data.stats.high} />
      </div>
      <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-card)]">
        {data.alerts.length ? data.alerts.map((alert) => (
          <article key={alert.id} className="grid gap-2 border-b border-[var(--border)] p-4 last:border-b-0 sm:grid-cols-[1fr_auto]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[var(--bg-subtle)] px-2 py-1 text-[10px] font-semibold uppercase text-[var(--text-secondary)]">{alert.severity}</span>
                <span className="text-xs text-[var(--text-muted)]">{alert.type} · {alert.source}</span>
              </div>
              <p className="mt-2 text-sm leading-6">{alert.content}</p>
            </div>
            <div className="text-xs text-[var(--text-muted)] sm:text-right">
              <p>{alert.isRead ? "Đã đọc" : "Chưa đọc"}</p>
              <time className="mt-1 block">{new Date(alert.createdAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</time>
            </div>
          </article>
        )) : <p className="p-8 text-center text-sm text-[var(--text-muted)]">Chưa có SocialAlert persisted.</p>}
      </div>
    </section>
  );
}

function ProvenanceNotice({ provenance }: { provenance: IntelligenceProvenance }) {
  const available = provenance.availability === "available";
  return (
    <div className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] p-4">
      {available ? <CheckCircle size={18} weight="fill" className="mt-0.5 shrink-0 text-[var(--success)]" aria-hidden="true" /> : <WarningCircle size={18} className="mt-0.5 shrink-0 text-[var(--warning)]" aria-hidden="true" />}
      <div>
        <p className="text-sm font-semibold">{available ? "Dữ liệu khả dụng" : provenance.availability === "partial" ? "Dữ liệu chưa đầy đủ" : "Dữ liệu chưa khả dụng"}</p>
        <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">Nguồn: {provenance.source} · scope: {provenance.scope} · cửa sổ: {provenance.window} · cập nhật {new Date(provenance.asOf).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</p>
        {provenance.warning ? <p className="mt-1 text-xs text-[var(--warning)]">{provenance.warning}</p> : null}
      </div>
    </div>
  );
}

function Metric({ label, value, unavailable = false }: { label: string; value: string | number; unavailable?: boolean }) {
  return (
    <article className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4">
      <p className={`text-2xl font-extrabold ${unavailable ? "text-[var(--text-muted)]" : "text-[var(--text)]"}`}>{typeof value === "number" ? value.toLocaleString("vi-VN") : value}</p>
      <p className="mt-1 text-xs text-[var(--text-muted)]">{label}</p>
    </article>
  );
}

function PostTable({ posts, top }: { posts: IntelligencePerformanceData["recentPosts"]; top: boolean }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-card)]">
      <div className="border-b border-[var(--border)] p-4">
        <h2 className="text-sm font-bold">{top ? "Post có nhiều lượt thích nhất" : "Post gần đây trong phạm vi"}</h2>
      </div>
      {posts.length ? posts.map((post) => (
        <article key={post.id} className="grid gap-3 border-b border-[var(--border)] p-4 last:border-b-0 sm:grid-cols-[1fr_auto]">
          <div className="min-w-0">
            <p className="line-clamp-2 text-sm font-semibold">{post.caption}</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{post.pageName} · {post.platform} · {post.status}</p>
          </div>
          <div className="text-xs text-[var(--text-muted)] sm:text-right">
            {post.analytics ? (
              <>
                <p>{post.analytics.reach.toLocaleString("vi-VN")} reach · {post.analytics.likes} like</p>
                <p className="mt-1">Analytics {new Date(post.analytics.fetchedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</p>
              </>
            ) : <p>Chưa có analytics</p>}
          </div>
        </article>
      )) : <p className="p-8 text-center text-sm text-[var(--text-muted)]">Không có Post phù hợp trong phạm vi đã chọn.</p>}
    </div>
  );
}

function WorkspaceLink({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href} className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-5 hover:bg-[var(--bg-subtle)]">
      <h3 className="font-bold">{title}</h3>
      <p className="mt-1 text-sm text-[var(--text-muted)]">{description}</p>
    </Link>
  );
}

function formatMetric(value: number | null) {
  return value == null ? "Chưa đo" : value.toLocaleString("vi-VN");
}

function formatCompleteness(value: number | null) {
  return value == null ? "Chưa xác định" : `${Math.round(value * 100)}%`;
}
