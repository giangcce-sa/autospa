import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarBlank, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { PromotionManager } from "@/components/modules/promotions/PromotionManager";
import { WorkspacePermissionState } from "@/components/workspace/WorkspacePermissionState";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { ROUTES_BY_ID } from "@/config/routes";
import { getPromotionCapacity, getPromotionPosts, getPromotionServices, type PromotionPostData } from "@/lib/growth-promotions";
import { AccessError } from "@/lib/page-access";
import { resolveWorkspaceAccess } from "@/lib/workspace-access";
import { parseWorkspaceUrl, workspaceScopesForRoute } from "@/lib/workspace-url";

export interface GrowthPromotionsWorkspaceProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function GrowthPromotionsWorkspace({ searchParams }: GrowthPromotionsWorkspaceProps) {
  const route = ROUTES_BY_ID.get("growth-promotions");
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

  return (
    <WorkspaceShell route={route} state={access.state} pages={access.pages} effectiveScope={effectiveScope}>
      {currentView.id === "overview" || currentView.id === "capacity" ? (
        <PromotionCapacityContent overview={currentView.id === "overview"} />
      ) : access.state.pageId ? (
        <PromotionPageContent facebookPageId={access.state.pageId} view={currentView.id} canMutate={access.canMutate} />
      ) : null}
    </WorkspaceShell>
  );
}

async function PromotionPageContent({ facebookPageId, view, canMutate }: { facebookPageId: string; view: string; canMutate: boolean }) {
  const [services, posts] = await Promise.all([
    getPromotionServices(facebookPageId),
    getPromotionPosts(facebookPageId),
  ]);

  if (view === "results") {
    return (
      <section className="space-y-4">
        <TruthNotice>Đây là trạng thái persisted của Post khuyến mãi theo Page. “Published” chỉ được hiển thị khi Publishing đã lưu kết quả; schema hiện chưa có attribution doanh thu cho offer.</TruthNotice>
        <PromotionHistory posts={posts} facebookPageId={facebookPageId} />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <TruthNotice>Generate chỉ tạo một Post draft theo Page. Review, hình ảnh, schedule và publish tiếp tục trong canonical Publishing bằng cùng Post ID.</TruthNotice>
      <PromotionManager facebookPageId={facebookPageId} initialServices={services} initialHistory={posts} canMutate={canMutate} />
    </section>
  );
}

async function PromotionCapacityContent({ overview }: { overview: boolean }) {
  const capacity = await getPromotionCapacity();
  return (
    <section className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg border border-[var(--warning)] bg-[var(--bg-subtle)] p-4">
        <WarningCircle size={19} className="mt-0.5 shrink-0 text-[var(--warning)]" aria-hidden="true" />
        <div>
          <h2 className="text-sm font-bold">Ước tính công suất — chưa phải lịch vận hành chuẩn</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{capacity.warning}</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Nguồn: {capacity.source} · cửa sổ: {capacity.window} · cập nhật {new Date(capacity.asOf).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {capacity.gaps.length ? capacity.gaps.map((gap) => (
          <article key={gap.date} className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4">
            <div className="flex items-center gap-2">
              <CalendarBlank size={15} className="text-[var(--accent)]" aria-hidden="true" />
              <h3 className="text-sm font-bold">{gap.label}</h3>
            </div>
            <p className="mt-3 text-2xl font-extrabold">{Math.round(gap.fillRate * 100)}%</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{gap.filledSlots}/{gap.estimatedCapacity} slot ước tính · còn {gap.hoursUntil} giờ</p>
          </article>
        )) : <p className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-8 text-sm text-[var(--text-muted)] sm:col-span-3">Không phát hiện khoảng trống dưới ngưỡng 60% trong dữ liệu hiện có.</p>}
      </div>
      {overview ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/growth/promotions?view=offers&scope=current" className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-5 hover:bg-[var(--bg-subtle)]">
            <h3 className="font-bold">Tạo draft ưu đãi theo Page</h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Persist Post trước rồi chuyển sang Publishing.</p>
          </Link>
          <Link href="/growth/promotions?view=capacity&scope=account" className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-5 hover:bg-[var(--bg-subtle)]">
            <h3 className="font-bold">Xem đầy đủ công suất</h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Kiểm tra nguồn, cửa sổ và độ đầy đủ trước khi quyết định.</p>
          </Link>
        </div>
      ) : null}
    </section>
  );
}

function PromotionHistory({ posts, facebookPageId }: { posts: PromotionPostData[]; facebookPageId: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-card)]">
      {posts.length ? posts.map((post) => (
        <article key={post.id} className="border-b border-[var(--border)] p-4 last:border-b-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm font-semibold text-[var(--text)]">{post.caption}</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{post.service?.name ?? "Không giới hạn dịch vụ"} · {post.platform}</p>
            </div>
            <span className="rounded-full bg-[var(--bg-subtle)] px-2 py-1 text-[10px] font-semibold text-[var(--text-secondary)]">{post.status}</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <time className="text-xs text-[var(--text-muted)]">{new Date(post.createdAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</time>
            <Link href={`/creative/publishing?view=composer&scope=current&pageId=${encodeURIComponent(facebookPageId)}&id=${encodeURIComponent(post.id)}`} className="text-xs font-semibold text-[var(--accent)]">Mở trong Publishing</Link>
          </div>
        </article>
      )) : <p className="p-8 text-center text-sm text-[var(--text-muted)]">Chưa có Post khuyến mãi cho Facebook Page này.</p>}
    </div>
  );
}

function TruthNotice({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] p-4 text-sm leading-6 text-[var(--text-secondary)]">{children}</p>;
}
