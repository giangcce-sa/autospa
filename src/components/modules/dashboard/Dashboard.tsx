"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowRight, CheckCircle, FilmSlate, Megaphone, UsersThree, WarningCircle } from "@phosphor-icons/react";
import { useActivePage } from "@/contexts/ActivePageContext";

type QueueItem = {
  id: string; type: string; priority: "critical" | "high" | "medium" | "low";
  title: string; detail: string; href: string; primaryAction: string; dueLabel?: string;
};

interface CommandData {
  stats: { scheduled: number; unreadMessages: number; pendingCare: number; hotLeads: number };
  kpis: { revenueToday: number; bookingsToday: number; leadsToday: number; criticalTasks: number; queueTotal: number };
  todayQueue: QueueItem[];
  contentFactory: { scheduledToday: number; reviewBlocked: number };
  adsCommand: { actionsToday: number; pendingApprovals: number };
  aiTasks: { failedJobs: number; recentJobs: Array<{ id: string; name: string; status: string; summary?: string }> };
  highlights: { scheduledToday: number; failedJobs: number };
}

function money(value: number) {
  if (!value) return "0 đ";
  if (value >= 1_000_000) return `${(value / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tr`;
  return `${Math.round(value / 1000).toLocaleString("vi-VN")}k`;
}

function Metric({ label, value, note, danger = false }: { label: string; value: string; note: string; danger?: boolean }) {
  return <div className="min-w-0 border-l border-[var(--border)] pl-4 first:border-l-0 first:pl-0 sm:pl-5"><p className="text-[13px] font-medium text-[var(--text-secondary)]">{label}</p><p className="mt-1 font-mono text-[23px] font-semibold leading-tight text-[var(--text)] sm:text-[26px]">{value}</p><p className={`mt-1 text-[12px] font-medium ${danger ? "text-[var(--danger)]" : "text-[var(--accent)]"}`}>{note}</p></div>;
}

function DashboardSkeleton() {
  return <div className="space-y-8"><div className="h-20 w-full animate-pulse rounded-md bg-[var(--bg-subtle)]" /><div className="grid gap-8 xl:grid-cols-[1.35fr_.65fr]"><div className="h-72 animate-pulse rounded-md bg-[var(--bg-subtle)]" /><div className="h-72 animate-pulse rounded-md bg-[var(--bg-subtle)]" /></div></div>;
}

export function Dashboard() {
  const { data: session } = useSession();
  const { selectedPageId } = useActivePage();
  const [data, setData] = useState<CommandData | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const role = (session?.user as { role?: string } | undefined)?.role;
    if (session && role !== "owner" && !selectedPageId) return;
    const query = selectedPageId ? `?facebookPageId=${encodeURIComponent(selectedPageId)}` : "";
    setError("");
    setData(null);
    fetch(`/api/dashboard/command-center${query}`).then(async (response) => {
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || "Không tải được dashboard");
      setData(payload.data);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)));
  }, [selectedPageId, session]);

  const rawName = (session?.user?.name || "bạn").trim().split(/\s+/).slice(-1)[0];
  const firstName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
  const dateLabel = useMemo(() => new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit" }).format(new Date()), []);
  const queue = data?.todayQueue.slice(0, 5) || [];
  const contentQueue = data?.todayQueue.filter((item) => ["publish", "review", "approval"].includes(item.type)).slice(0, 3) || [];

  return (
    <div>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-[13px] font-medium capitalize text-[var(--text-muted)]">{dateLabel}</p><h1 className="text-[28px] font-extrabold leading-tight sm:text-[32px]">Chào buổi sáng, {firstName}</h1><p className="mt-2 text-sm text-[var(--text-secondary)]">{data ? (data.kpis.queueTotal > 0 ? `Hôm nay có ${data.kpis.queueTotal} việc cần xử lý.` : "Hôm nay chưa có việc nào cần xử lý.") : "AutoSpa đang tổng hợp công việc trong ngày."}</p></div><div className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)]"><span className={`h-2 w-2 rounded-full ${error ? "bg-[var(--danger)]" : "bg-[var(--success)]"}`} />{error ? "Dữ liệu cần được kiểm tra" : "Hệ thống đang hoạt động bình thường"}</div></header>

      {error ? <div className="flex gap-3 border-y border-[var(--danger)]/30 bg-[var(--danger-light)] px-4 py-4 text-sm text-[var(--danger)]"><WarningCircle size={20} className="shrink-0" /><div><p className="font-semibold">Không tải được dữ liệu vận hành</p><p className="mt-1 text-xs">{error}</p></div></div> : !data ? <DashboardSkeleton /> : <>
        <section className="grid grid-cols-2 gap-x-4 gap-y-6 border-y border-[var(--border)] py-5 sm:grid-cols-4 sm:gap-x-0">
          <Metric label="Doanh thu hôm nay" value={money(data.kpis.revenueToday)} note={`${data.kpis.bookingsToday} lịch hẹn đã ghi nhận`} />
          <Metric label="Lịch hẹn" value={String(data.kpis.bookingsToday)} note="Đã ghi nhận trong ngày" />
          <Metric label="Khách mới" value={String(data.kpis.leadsToday)} note={`${data.stats.hotLeads} khách cần ưu tiên`} />
          <Metric label="Tin nhắn mới" value={String(data.stats.unreadMessages)} note={data.stats.unreadMessages ? "Cần phản hồi" : "Đã xử lý hết"} danger={data.stats.unreadMessages > 0} />
        </section>

        <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_minmax(19rem,.65fr)]">
          <section>
            <div className="mb-3 flex items-end justify-between gap-4"><div><h2 className="text-[19px] font-bold">Việc cần làm</h2><p className="mt-1 text-[13px] text-[var(--text-muted)]">Sắp xếp theo mức độ ảnh hưởng</p></div><span className="text-[13px] font-medium text-[var(--text-secondary)]">{data.kpis.queueTotal} đang chờ</span></div>
            <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
              {queue.map((item) => <article key={item.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div className="min-w-0"><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${item.priority === "critical" ? "bg-[var(--danger)]" : item.priority === "high" ? "bg-[var(--warning)]" : "bg-[var(--text-muted)]"}`} /><h3 className="truncate text-[15px] font-semibold">{item.title}</h3></div><p className="mt-1 pl-4 text-[13px] text-[var(--text-muted)]">{item.detail}</p></div><Link href={item.href} className="flex items-center gap-2 justify-self-start text-[13px] font-semibold text-[var(--accent)] sm:justify-self-end">{item.primaryAction}<ArrowRight size={15} /></Link></article>)}
              {queue.length === 0 && <div className="flex items-center gap-3 py-8 text-sm text-[var(--accent)]"><CheckCircle size={22} weight="fill" />Không có việc gấp cần xử lý.</div>}
            </div>
            {data.kpis.queueTotal > queue.length && <Link href="/automation" className="mt-4 inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--accent)]">Xem toàn bộ hàng đợi <ArrowRight size={14} /></Link>}
          </section>

          <aside className="border-l border-[var(--border)] pl-6"><div className="flex items-center justify-between"><h2 className="text-[19px] font-bold">Nội dung cần chú ý</h2><Link href="/creative" className="text-[13px] font-semibold text-[var(--accent)]">Mở Sáng tạo</Link></div><div className="mt-4 divide-y divide-[var(--border)]">{contentQueue.map((item) => <Link href={item.href} key={item.id} className="block py-3"><p className="text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{item.detail}</p></Link>)}{contentQueue.length === 0 && <div className="py-8 text-sm text-[var(--text-muted)]">Không có nội dung bị chặn hoặc chờ duyệt.</div>}</div></aside>
        </div>

        <section className="mt-9"><div className="mb-4 flex items-center justify-between"><h2 className="text-[19px] font-bold">Đang vận hành</h2><Link href="/orchestrator" className="text-[13px] font-semibold text-[var(--accent)]">Xem tất cả</Link></div><div className="grid overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--border)] md:grid-cols-3">
          <Operation icon={FilmSlate} title="Nội dung hôm nay" detail={`${data.contentFactory.scheduledToday} sắp đăng · ${data.contentFactory.reviewBlocked} bị chặn`} tone="green" />
          <Operation icon={Megaphone} title="Tối ưu quảng cáo" detail={`${data.adsCommand.actionsToday} hành động · ${data.adsCommand.pendingApprovals} chờ duyệt`} tone="gold" />
          <Operation icon={UsersThree} title="Chăm sóc khách" detail={`${data.stats.pendingCare} khách đến hạn · ${data.stats.hotLeads} khách cần ưu tiên`} tone="blue" />
        </div>{data.aiTasks.failedJobs > 0 && <Link href="/orchestrator" className="mt-3 flex items-center gap-2 text-xs font-semibold text-[var(--danger)]"><WarningCircle size={15} />{data.aiTasks.failedJobs} tác vụ AI gần đây bị lỗi</Link>}</section>
      </>}
    </div>
  );
}

function Operation({ icon: IconComponent, title, detail, tone }: { icon: typeof FilmSlate; title: string; detail: string; tone: "green" | "gold" | "blue" }) {
  const toneClass = tone === "green" ? "bg-[var(--accent-light)] text-[var(--accent)]" : tone === "gold" ? "bg-[var(--premium-light)] text-[var(--premium)]" : "bg-[var(--blue-light)] text-[var(--blue)]";
  return <article className="flex min-h-28 items-center gap-4 bg-[var(--bg-card)] p-4"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md ${toneClass}`}><IconComponent size={21} weight="duotone" /></span><div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-xs text-[var(--text-muted)]">{detail}</p></div></article>;
}
