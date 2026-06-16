"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  CalendarCheck,
  CaretRight,
  ChatCircleDots,
  CheckCircle,
  ClockCountdown,
  Flame,
  FirstAidKit,
  PaperPlaneTilt,
  ShieldWarning,
  Sparkle,
} from "@phosphor-icons/react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SkeletonRow } from "@/components/ui/Skeleton";

type Priority = "critical" | "high" | "medium" | "low";
type QueueType = "approval" | "review" | "publish" | "lead" | "message" | "appointment" | "alert" | "care";

interface QueueItem {
  id: string;
  type: QueueType;
  priority: Priority;
  title: string;
  detail: string;
  href: string;
  primaryAction: string;
  secondaryAction?: string;
  dueLabel?: string;
  timestamp?: string;
}

interface CommandCenterData {
  todayQueue: QueueItem[];
  kpis: {
    pendingApprovals: number;
    criticalTasks: number;
    queueTotal: number;
  };
  highlights: {
    approvals: number;
    blockedPosts: number;
    alerts: number;
    scheduledToday: number;
  };
}

const TYPE_META: Record<QueueType, { label: string; icon: React.ElementType; color: string }> = {
  approval: { label: "Duyệt", icon: CheckCircle, color: "var(--premium)" },
  review: { label: "Reviewer", icon: ShieldWarning, color: "var(--rose)" },
  publish: { label: "Đăng bài", icon: PaperPlaneTilt, color: "var(--accent)" },
  lead: { label: "Lead", icon: Flame, color: "var(--rose)" },
  message: { label: "Inbox", icon: ChatCircleDots, color: "var(--blue)" },
  appointment: { label: "Lịch hẹn", icon: CalendarCheck, color: "var(--amber)" },
  alert: { label: "Alert", icon: Bell, color: "var(--danger)" },
  care: { label: "Care", icon: FirstAidKit, color: "var(--success)" },
};

const PRIORITY_META: Record<Priority, { label: string; variant: "danger" | "warning" | "info" | "neutral" }> = {
  critical: { label: "Gấp", variant: "danger" },
  high: { label: "Cao", variant: "warning" },
  medium: { label: "Hôm nay", variant: "info" },
  low: { label: "Khi rảnh", variant: "neutral" },
};

function timeAgo(ts?: string) {
  if (!ts) return "";
  const ms = Date.now() - new Date(ts).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "vừa xong";
  if (min < 60) return `${min}p trước`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h trước`;
  return `${Math.floor(hr / 24)}d trước`;
}

function EmptyQueue() {
  return (
    <div className="py-10 text-center">
      <div
        className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
        style={{ background: "var(--accent-light)", color: "var(--accent)" }}
      >
        <Sparkle size={20} weight="fill" />
      </div>
      <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
        Hôm nay chưa có việc gấp
      </p>
      <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
        Queue sạch. Có thể tạo nội dung mới hoặc kiểm tra lead chủ động.
      </p>
      <div className="flex items-center justify-center gap-2 mt-4">
        <Link
          href="/content"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ background: "var(--accent)", color: "white" }}
        >
          Tạo bài mới <ArrowRight size={11} />
        </Link>
        <Link
          href="/sale"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{ background: "var(--bg-subtle)", color: "var(--text-secondary)" }}
        >
          Xem sales
        </Link>
      </div>
    </div>
  );
}

export function TodayQueue() {
  const [data, setData] = useState<CommandCenterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "critical" | "sales" | "content">("all");

  useEffect(() => {
    fetch("/api/dashboard/command-center")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setData(res.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredQueue = useMemo(() => {
    const queue = data?.todayQueue ?? [];
    if (filter === "critical") return queue.filter((item) => item.priority === "critical");
    if (filter === "sales") return queue.filter((item) => ["lead", "message", "appointment", "care"].includes(item.type));
    if (filter === "content") return queue.filter((item) => ["publish", "review", "approval"].includes(item.type));
    return queue;
  }, [data?.todayQueue, filter]);

  const filters: Array<{ id: typeof filter; label: string; count: number }> = [
    { id: "all", label: "Tất cả", count: data?.kpis.queueTotal ?? 0 },
    { id: "critical", label: "Gấp", count: data?.kpis.criticalTasks ?? 0 },
    {
      id: "sales",
      label: "Sales",
      count: (data?.todayQueue ?? []).filter((item) => ["lead", "message", "appointment", "care"].includes(item.type)).length,
    },
    {
      id: "content",
      label: "Content",
      count: (data?.todayQueue ?? []).filter((item) => ["publish", "review", "approval"].includes(item.type)).length,
    },
  ];

  return (
    <Card id="today-queue" padding="none" className="overflow-hidden scroll-mt-20">
      <div className="p-5 pb-3">
        <CardHeader className="mb-3">
          <div>
            <div className="flex items-center gap-2">
              <ClockCountdown size={15} style={{ color: "var(--accent)" }} weight="fill" />
              <CardTitle>Today Queue</CardTitle>
            </div>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Các việc cần xử lý trước khi AI chạy tiếp.
            </p>
          </div>
          <Link href="/automation" className="text-[11px] flex items-center gap-0.5 transition-opacity hover:opacity-80" style={{ color: "var(--text-muted)" }}>
            Approval inbox <ArrowRight size={10} />
          </Link>
        </CardHeader>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <div className="rounded-lg px-3 py-2" style={{ background: "var(--rose-light)" }}>
            <p className="text-lg font-bold leading-none" style={{ color: "var(--rose)" }}>{data?.highlights.blockedPosts ?? 0}</p>
            <p className="text-[10px] mt-1" style={{ color: "var(--rose)" }}>Bài bị chặn</p>
          </div>
          <div className="rounded-lg px-3 py-2" style={{ background: "var(--premium-light)" }}>
            <p className="text-lg font-bold leading-none" style={{ color: "var(--premium)" }}>{data?.highlights.approvals ?? 0}</p>
            <p className="text-[10px] mt-1" style={{ color: "var(--premium)" }}>Cần duyệt</p>
          </div>
          <div className="rounded-lg px-3 py-2" style={{ background: "var(--amber-light)" }}>
            <p className="text-lg font-bold leading-none" style={{ color: "var(--amber)" }}>{data?.highlights.alerts ?? 0}</p>
            <p className="text-[10px] mt-1" style={{ color: "var(--amber)" }}>Alert mở</p>
          </div>
          <div className="rounded-lg px-3 py-2" style={{ background: "var(--accent-light)" }}>
            <p className="text-lg font-bold leading-none" style={{ color: "var(--accent)" }}>{data?.highlights.scheduledToday ?? 0}</p>
            <p className="text-[10px] mt-1" style={{ color: "var(--accent)" }}>Bài hôm nay</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {filters.map((item) => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all"
              style={filter === item.id
                ? { background: "var(--accent)", color: "white" }
                : { background: "var(--bg-subtle)", color: "var(--text-secondary)" }}
            >
              {item.label} <span className="tabular-nums opacity-80">{item.count}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="px-5 pb-5">
          {[1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} />)}
        </div>
      ) : filteredQueue.length === 0 ? (
        <EmptyQueue />
      ) : (
        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
          {filteredQueue.map((item) => {
            const meta = TYPE_META[item.type];
            const priority = PRIORITY_META[item.priority];
            const Icon = meta.icon;
            return (
              <div key={item.id} className="group px-5 py-3 transition-colors hover:bg-[var(--bg-subtle)]">
                <div className="flex items-start gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: meta.color + "18", color: meta.color }}
                  >
                    <Icon size={17} weight="fill" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <Badge variant={priority.variant}>{priority.label}</Badge>
                      <span className="text-[10px] font-medium" style={{ color: meta.color }}>{meta.label}</span>
                      {item.dueLabel && (
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                          · {item.dueLabel}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold leading-snug" style={{ color: "var(--text)" }}>{item.title}</p>
                    <p className="text-xs mt-0.5 leading-snug" style={{ color: "var(--text-muted)" }}>{item.detail}</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-2 shrink-0">
                    {item.timestamp && (
                      <span className="text-[10px] tabular-nums" style={{ color: "var(--text-muted)" }}>
                        {timeAgo(item.timestamp)}
                      </span>
                    )}
                    <Link
                      href={item.href}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all group-hover:translate-x-0.5"
                      style={{ background: meta.color, color: "white" }}
                    >
                      {item.primaryAction}
                      <CaretRight size={10} weight="bold" />
                    </Link>
                  </div>
                </div>
                <div className="sm:hidden flex items-center gap-2 mt-2 pl-12">
                  <Link
                    href={item.href}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold"
                    style={{ background: meta.color, color: "white" }}
                  >
                    {item.primaryAction}
                    <CaretRight size={10} weight="bold" />
                  </Link>
                  {item.secondaryAction && (
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{item.secondaryAction}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
