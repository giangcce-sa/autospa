"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  PaperPlaneTilt, CalendarBlank, ChatCircleDots,
  Users, Flame, Bell, Sparkle, ArrowRight, Circle,
  Gauge, ChartLine,
} from "@phosphor-icons/react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { MorningBriefCard } from "./MorningBriefCard";
import { TodayQueue } from "./TodayQueue";
import { QuickActions } from "./QuickActions";
import { ActivityFeed } from "./ActivityFeed";
import { CEODashboard } from "./ceo/CEODashboard";

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

const SETUP_STEPS = [
  { href: "/settings", label: "Cấu hình API Keys", desc: "Claude, OpenAI, Facebook, Zalo" },
  { href: "/services", label: "Thêm dịch vụ spa", desc: "Tên, giá, mô tả" },
  { href: "/brand", label: "Thông tin thương hiệu", desc: "Giới thiệu, FAQ, chính sách" },
  { href: "/brand-kit", label: "Brand Kit", desc: "Logo, màu sắc thương hiệu" },
  { href: "/style-training", label: "Huấn luyện văn phong AI", desc: "Upload bài mẫu" },
  { href: "/content-research", label: "Tạo kế hoạch nội dung đầu tiên", desc: "AI tự nghiên cứu & đề xuất" },
];

const VIEW_KEY = "dashboard-view";

export function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [view, setView] = useState<"today" | "ceo">("today");

  useEffect(() => {
    fetch("/api/dashboard").then((r) => r.json()).then((res) => {
      if (res.data) setStats(res.data);
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

  const isNewUser = stats && stats.totalPosts === 0 && stats.services === 0;

  // ─── New user onboarding view ─────────────────────────────
  if (isNewUser) {
    return (
      <div className="space-y-6">
        <div
          className="rounded-2xl p-6 flex items-center justify-between gap-4"
          style={{ background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%)" }}
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkle size={16} weight="fill" color="rgba(255,255,255,0.9)" />
              <p className="font-semibold text-xs uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.85)" }}>AutoSpa Marketing AI</p>
            </div>
            <h1 className="text-xl font-bold" style={{ color: "white" }}>Chào mừng! Hãy bắt đầu thiết lập.</h1>
            <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.78)" }}>
              Làm theo 6 bước bên dưới để kích hoạt bộ máy marketing tự động.
            </p>
          </div>
          <Link
            href="/settings"
            className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm shrink-0 transition-opacity hover:opacity-80"
            style={{ background: "rgba(255,255,255,0.2)", color: "white" }}
          >
            Bắt đầu
            <ArrowRight size={14} />
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Thiết lập ban đầu</CardTitle>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>0 / 6 hoàn thành</span>
          </CardHeader>
          <div className="divide-y -mx-5" style={{ borderColor: "var(--border)" }}>
            {SETUP_STEPS.map((step, i) => (
              <Link key={step.href} href={step.href} className="flex items-center gap-3 px-5 py-3 transition-opacity hover:opacity-80">
                <Circle size={18} style={{ color: "var(--border-strong)", flexShrink: 0 }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
                    <span className="mr-1.5" style={{ color: "var(--text-muted)" }}>{i + 1}.</span>
                    {step.label}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{step.desc}</p>
                </div>
                <ArrowRight size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              </Link>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  // ─── View toggle ──────────────────────────────────────────
  const ViewToggle = (
    <div className="flex items-center gap-1 p-1 rounded-xl self-start" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
      <button
        onClick={() => switchView("today")}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
        style={view === "today"
          ? { background: "var(--bg-card)", color: "var(--accent)", boxShadow: "var(--shadow-sm)" }
          : { color: "var(--text-muted)" }}
      >
        <Gauge size={12} weight={view === "today" ? "fill" : "regular"} />
        Today
      </button>
      <button
        onClick={() => switchView("ceo")}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
        style={view === "ceo"
          ? { background: "var(--premium)", color: "white", boxShadow: "var(--shadow-premium)" }
          : { color: "var(--text-muted)" }}
      >
        <ChartLine size={12} weight={view === "ceo" ? "fill" : "regular"} />
        CEO View
      </button>
    </div>
  );

  // ─── CEO Dashboard view ────────────────────────────────────
  if (view === "ceo") {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">{ViewToggle}</div>
        <CEODashboard />
      </div>
    );
  }

  // ─── Daily "Today" view ───────────────────────────────────
  return (
    <div className="space-y-6">
      {/* View toggle */}
      <div className="flex justify-end">{ViewToggle}</div>

      {/* 1. Daily Standup (CEO Council brief) — hero */}
      <MorningBriefCard />

      {/* 2. Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat
          label="Bài đã đăng tháng này"
          value={stats?.publishedThisMonth ?? 0}
          icon={PaperPlaneTilt}
          color="var(--accent)"
          href="/library"
        />
        <Stat
          label="Đang lên lịch"
          value={stats?.scheduled ?? 0}
          icon={CalendarBlank}
          color="var(--amber)"
          href="/publish"
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
          label="Khách hàng CRM"
          value={stats?.totalCustomers ?? 0}
          icon={Users}
          color="var(--blue)"
          href="/crm"
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

      {/* 4. Today's queue (3 columns) */}
      <TodayQueue />

      {/* 5. Activity feed */}
      <ActivityFeed />
    </div>
  );
}
