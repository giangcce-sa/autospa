"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  CalendarBlank, ChatCircleDots,
  Flame, Bell, Sparkle, ArrowRight,
  Gauge, ChartLine, CheckCircle, WarningCircle,
  Check, CaretRight, Compass,
} from "@phosphor-icons/react";
import { Card } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { MorningBriefCard } from "./MorningBriefCard";
import { TodayQueue } from "./TodayQueue";
import { QuickActions } from "./QuickActions";
import { ActivityFeed } from "./ActivityFeed";
import { CEODashboard } from "./ceo/CEODashboard";
import { useExperienceMode } from "@/contexts/ExperienceModeContext";

interface Stats {
  totalPosts: number;
  publishedThisMonth: number;
  scheduled: number;
  pendingAppointments: number;
  unreadMessages: number;
  services: number;
  totalCustomers: number;
  hotLeads: number;
  pendingCare: number;
  unreadAlerts: number;
}

interface CommandCenterData {
  stats: Stats;
  setup: {
    completed: number;
    total: number;
    complete: boolean;
    steps: Array<{
      id: string;
      label: string;
      description: string;
      href: string;
      complete: boolean;
    }>;
  };
  kpis: {
    pendingApprovals: number;
    criticalTasks: number;
    queueTotal: number;
  };
}

const VIEW_KEY = "dashboard-view";

export function Dashboard() {
  const { mode } = useExperienceMode();
  const [stats, setStats] = useState<Stats | null>(null);
  const [command, setCommand] = useState<CommandCenterData | null>(null);
  const [view, setView] = useState<"today" | "ceo">("today");

  useEffect(() => {
    fetch("/api/dashboard/command-center").then((r) => r.json()).then((res) => {
      if (res.data) {
        setCommand(res.data);
        setStats(res.data.stats);
      }
    }).catch(() => {
      fetch("/api/dashboard").then((r) => r.json()).then((res) => {
        if (res.data) setStats(res.data);
      });
    });
    try {
      const saved = localStorage.getItem(VIEW_KEY);
      if (saved === "ceo") setView("ceo");
    } catch { /* ignore */ }
  }, []);

  const switchView = (v: "today" | "ceo") => {
    setView(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* ignore */ }
  };

  // ─── View toggle ──────────────────────────────────────────
  const ViewToggle = (
    <div className="flex items-center gap-1 p-1 rounded-md self-start" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
      <button
        onClick={() => switchView("today")}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
        style={view === "today"
          ? { background: "var(--bg-card)", color: "var(--accent)", boxShadow: "var(--shadow-sm)" }
          : { color: "var(--text-muted)" }}
      >
        <Gauge size={12} weight={view === "today" ? "fill" : "regular"} />
        Hôm nay
      </button>
      <button
        onClick={() => switchView("ceo")}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
        style={view === "ceo"
          ? { background: "var(--premium)", color: "white", boxShadow: "var(--shadow-premium)" }
          : { color: "var(--text-muted)" }}
      >
        <ChartLine size={12} weight={view === "ceo" ? "fill" : "regular"} />
        CEO
      </button>
    </div>
  );

  // ─── CEO Dashboard view ────────────────────────────────────
  if (mode === "advanced" && view === "ceo") {
    return (
      <div className="dashboard-readable space-y-4">
        <div className="flex justify-end">{ViewToggle}</div>
        <CEODashboard />
      </div>
    );
  }

  const setup = command?.setup;
  const nextSetupStep = setup?.steps.find((step) => !step.complete);

  if (mode === "simple") {
    return (
      <div className="dashboard-readable space-y-6">
        <section
          className="rounded-lg border p-5 sm:p-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
          style={{ background: "var(--bg-card)", borderColor: "var(--border)", boxShadow: "var(--shadow-sm)" }}
        >
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 mb-1" style={{ color: "var(--accent)" }}>
              <Compass size={16} weight="fill" />
              <span className="text-xs font-semibold">Trung tâm công việc</span>
            </div>
            <h1 className="text-[28px] sm:text-[32px] font-extrabold">Hôm nay cần làm gì?</h1>
            <p className="text-sm mt-1 max-w-2xl" style={{ color: "var(--text-muted)" }}>
              AutoSpa đã gom các việc quan trọng theo thứ tự ưu tiên. Xử lý từ trên xuống để không bỏ sót khách hàng và nội dung.
            </p>
          </div>
          <Link
            href="/content"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-semibold shrink-0 transition-all hover:-translate-y-px active:scale-[0.98]"
            style={{ background: "var(--accent)", color: "white", boxShadow: "0 8px 18px rgba(47,111,84,0.2)" }}
          >
            <Sparkle size={14} weight="fill" />
            Tạo bài mới
          </Link>
        </section>

        {setup && !setup.complete && (
          <Card padding="none" className="overflow-hidden">
            <div className="grid lg:grid-cols-[0.8fr_1.2fr]">
              <div className="p-5" style={{ background: "var(--accent-soft)" }}>
                <p className="text-xs font-semibold" style={{ color: "var(--accent)" }}>Thiết lập AutoSpa</p>
                <p className="text-3xl font-bold mt-2 tabular-nums" style={{ color: "var(--text)" }}>
                  {setup.completed}/{setup.total}
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>bước đã hoàn thành</p>
                <div className="h-2 rounded-full overflow-hidden mt-4" style={{ background: "var(--bg-card)" }}>
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{ width: `${(setup.completed / setup.total) * 100}%`, background: "var(--accent)" }}
                  />
                </div>
                {nextSetupStep && (
                  <Link href={nextSetupStep.href} className="inline-flex items-center gap-1 mt-4 text-xs font-semibold" style={{ color: "var(--accent)" }}>
                    Làm bước tiếp theo <ArrowRight size={11} />
                  </Link>
                )}
              </div>
              <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                {setup.steps.map((step) => (
                  <Link key={step.id} href={step.href} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--bg-subtle)]">
                    <span
                      className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                      style={step.complete
                        ? { background: "var(--accent)", color: "white" }
                        : { background: "var(--bg-subtle)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
                    >
                      {step.complete ? <Check size={13} weight="bold" /> : <span className="w-1.5 h-1.5 rounded-full" style={{ background: "currentColor" }} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold" style={{ color: step.complete ? "var(--text-muted)" : "var(--text)" }}>{step.label}</p>
                      {!step.complete && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{step.description}</p>}
                    </div>
                    <CaretRight size={13} style={{ color: "var(--text-muted)" }} />
                  </Link>
                ))}
              </div>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Cần xử lý ngay" value={command?.kpis.criticalTasks ?? 0} icon={WarningCircle} color="var(--rose)" href="#today-queue" />
          <Stat label="Tin nhắn mới" value={stats?.unreadMessages ?? 0} icon={ChatCircleDots} color="var(--blue)" href="/inbox" />
          <Stat label="Lead cần chăm" value={stats?.hotLeads ?? 0} icon={Flame} color="var(--rose)" href="/sale" />
          <Stat label="Bài đang lên lịch" value={stats?.scheduled ?? 0} icon={CalendarBlank} color="var(--amber)" href="/publish" />
        </div>

        <TodayQueue />

        <section>
          <p className="text-xs font-bold mb-2" style={{ color: "var(--text-muted)" }}>Tạo nhanh</p>
          <QuickActions simple />
        </section>

        <MorningBriefCard />
        <ActivityFeed />
      </div>
    );
  }

  // ─── Daily "Today" view ───────────────────────────────────
  return (
    <div className="dashboard-readable space-y-6">
      {/* View toggle */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Bảng điều hành nâng cao</h1>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Theo dõi toàn bộ vận hành, AI và hiệu suất marketing.</p>
        </div>
        {ViewToggle}
      </div>

      {/* 1. Daily Standup (CEO Council brief) — hero */}
      <MorningBriefCard />

      {/* 2. Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <Stat
          label="Việc gấp cần xử lý"
          value={command?.kpis.criticalTasks ?? 0}
          icon={WarningCircle}
          color="var(--rose)"
          href="#today-queue"
        />
        <Stat
          label="Đang chờ duyệt"
          value={command?.kpis.pendingApprovals ?? 0}
          icon={CheckCircle}
          color="var(--premium)"
          href="/automation"
        />
        <Stat
          label="Tin nhắn chưa đọc"
          value={stats?.unreadMessages ?? 0}
          icon={ChatCircleDots}
          color="var(--rose)"
          href="/inbox"
        />
        <Stat
          label="Lead nóng"
          value={stats?.hotLeads ?? 0}
          icon={Flame}
          color="var(--rose)"
          href="/sale"
        />
        <Stat
          label="Đang lên lịch"
          value={stats?.scheduled ?? 0}
          icon={CalendarBlank}
          color="var(--amber)"
          href="/publish"
        />
        <Stat
          label="Cảnh báo mới"
          value={stats?.unreadAlerts ?? 0}
          icon={Bell}
          color="var(--amber)"
          href="/listening"
        />
      </div>

      {/* 3. Quick actions */}
      <QuickActions />

      {/* 4. Today's command queue */}
      <TodayQueue />

      {/* 5. Activity feed */}
      <ActivityFeed />
    </div>
  );
}
