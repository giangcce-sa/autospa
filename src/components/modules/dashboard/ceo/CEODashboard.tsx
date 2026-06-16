"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Sun, ArrowsClockwise, Sparkle, TrendUp,
  CalendarBlank, ChatCircleDots, Flame, Bell,
  PaperPlaneTilt, CurrencyCircleDollar, Robot, ArrowRight,
} from "@phosphor-icons/react";
import { AITeamStatus } from "./AITeamStatus";
import { LeadPipeline } from "./LeadPipeline";
import { CEOTaskCenter } from "./CEOTaskCenter";
import { ContentFactory } from "./ContentFactory";
import { AdsCommandCenter } from "./AdsCommandCenter";
import { HotLeads } from "./HotLeads";

interface BriefData { summary: string; date: string; }
interface Stats {
  publishedThisMonth: number; scheduled: number;
  unreadMessages: number; hotLeads: number;
  totalCustomers: number; unreadAlerts: number;
}

function vnd(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}tỷ`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}tr`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(Math.round(n));
}

/* ─── Section card with colored top border ─── */
function SectionCard({
  title, icon, iconColor, topColor, href, hrefLabel, children, className = "",
}: {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  topColor: string;
  href?: string;
  hrefLabel?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const Icon = icon;
  return (
    <div
      className={`ceo-section-card rounded-2xl p-4 ${className}`}
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      {/* Colored top accent line */}
      <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: `linear-gradient(90deg, ${topColor}, ${topColor}88)` }} />

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: iconColor + "20" }}>
            <Icon size={12} weight="fill" style={{ color: iconColor }} />
          </div>
          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text)" }}>{title}</p>
        </div>
        {href && (
          <Link
            href={href}
            className="flex items-center gap-0.5 text-[10px] transition-opacity hover:opacity-70"
            style={{ color: "var(--text-muted)" }}
          >
            {hrefLabel} <ArrowRight size={9} />
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

/* ─── KPI Card ─── */
function KPICard({
  label, value, icon, color, href, delta, positive, delay,
}: {
  label: string; value: string | number; icon: React.ElementType;
  color: string; href: string; delta?: string; positive?: boolean; delay: number;
}) {
  const Icon = icon;
  return (
    <Link
      href={href}
      className="ceo-kpi-card rounded-xl p-3 relative overflow-hidden group"
      style={{
        background: "var(--bg-card)",
        border: `1px solid ${color}33`,
        animationDelay: `${delay}ms`,
      }}
    >
      {/* subtle color wash */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"
        style={{ background: `radial-gradient(ellipse at top left, ${color}0a 0%, transparent 70%)` }}
      />
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: color + "18" }}>
            <Icon size={14} weight="fill" style={{ color }} />
          </div>
          {delta && (
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{
                background: positive ? "var(--success-light)" : "var(--danger-light)",
                color: positive ? "var(--success)" : "var(--danger)",
              }}>
              {delta}
            </span>
          )}
        </div>
        <p className="text-xl font-bold tabular-nums leading-none" style={{ color: "var(--text)" }}>{value}</p>
        <p className="text-[10px] mt-1 leading-tight" style={{ color: "var(--text-muted)" }}>{label}</p>
      </div>
    </Link>
  );
}

export function CEODashboard() {
  const [brief, setBrief] = useState<BriefData | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [revenue, setRevenue] = useState(0);
  const [revenueChange, setRevenueChange] = useState(0);
  const [briefLoading, setBriefLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  const todayStr = new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });

  useEffect(() => {
    fetch("/api/morning-brief")
      .then((r) => r.json())
      .then((res) => { if (res.data) setBrief({ summary: res.data.summary, date: res.data.date }); })
      .finally(() => setBriefLoading(false));

    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((res) => { if (res.data) setStats(res.data); });

    fetch("/api/analytics")
      .then((r) => r.json())
      .then((res) => {
        if (res.data) {
          setRevenue(res.data.totalRevenue ?? 0);
          setRevenueChange(res.data.revenueChange ?? 0);
        }
      });
  }, []);

  const regenerateBrief = async () => {
    setRegenerating(true);
    try {
      const res = await fetch("/api/morning-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "regenerate" }),
      });
      const data = await res.json();
      if (data.data) setBrief({ summary: data.data.summary, date: data.data.date });
    } finally { setRegenerating(false); }
  };

  return (
    <div className="space-y-4">

      {/* ── HERO BANNER ──────────────────────────────────────── */}
      <div
        className="ceo-row-1 rounded-2xl p-5 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #8b6914 0%, var(--premium) 40%, #c8a84e 70%, var(--premium-hover) 100%)",
          boxShadow: "0 8px 32px rgba(176,137,64,0.35), 0 2px 8px rgba(0,0,0,0.1)",
          minHeight: 140,
        }}
      >
        {/* Animated floating orbs */}
        <div className="ceo-orb absolute -right-12 -top-12 w-48 h-48 rounded-full" style={{ background: "radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)" }} />
        <div className="ceo-orb-2 absolute right-24 bottom-0 w-32 h-32 rounded-full" style={{ background: "radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)" }} />
        <div className="ceo-orb-3 absolute left-1/2 top-0 w-24 h-24 rounded-full" style={{ background: "radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)" }} />

        {/* Noise texture overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")" }} />

        <div className="relative flex items-start justify-between gap-6 flex-wrap">
          {/* Left: brief text */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,255,255,0.2)" }}>
                <Sun size={13} weight="fill" color="white" />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.75)" }}>
                CEO Daily Briefing · {todayStr}
              </p>
            </div>

            {briefLoading ? (
              <div className="space-y-2 mt-1">
                {[3/4, 1, 4/5].map((w, i) => (
                  <div key={i} className="h-3 rounded-lg" style={{ width: `${w * 100}%`, background: "rgba(255,255,255,0.2)", animation: "skeleton-shimmer 1.5s ease-in-out infinite", backgroundSize: "200% 100%" }} />
                ))}
              </div>
            ) : brief ? (
              <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.93)" }}>
                {brief.summary.slice(0, 240)}{brief.summary.length > 240 ? "..." : ""}
              </p>
            ) : (
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
                Chưa có brief hôm nay. Nhấn tạo mới để AI phân tích tình hình kinh doanh.
              </p>
            )}

            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={regenerateBrief}
                disabled={regenerating}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                style={{ background: "rgba(255,255,255,0.22)", color: "white", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.2)" }}
              >
                <ArrowsClockwise size={11} className={regenerating ? "animate-spin" : ""} />
                {regenerating ? "Đang tạo..." : "Tạo mới"}
              </button>
              <Link
                href="/morning-brief"
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105"
                style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.9)", backdropFilter: "blur(8px)" }}
              >
                Xem đầy đủ <ArrowRight size={10} />
              </Link>
            </div>
          </div>

          {/* Right: 3 KPI highlights */}
          <div className="flex gap-4 shrink-0">
            {[
              { label: "Lead nóng", value: stats?.hotLeads ?? 0, prefix: "+" },
              { label: "Lên lịch", value: stats?.scheduled ?? 0, prefix: "+" },
              { label: "Doanh thu", value: revenue > 0 ? `${vnd(revenue)}đ` : "—", prefix: "" },
            ].map((k) => (
              <div
                key={k.label}
                className="text-center px-3 py-2 rounded-xl"
                style={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.15)", minWidth: 64 }}
              >
                <p className="text-2xl font-black tabular-nums leading-none" style={{ color: "white", textShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
                  {k.prefix}{k.value}
                </p>
                <p className="text-[9px] mt-1 font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.65)" }}>{k.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── KPI ROW ──────────────────────────────────────────── */}
      <div className="ceo-row-2 grid grid-cols-3 lg:grid-cols-6 gap-2">
        <KPICard label="Doanh thu" value={revenue > 0 ? `${vnd(revenue)}đ` : "—"} icon={CurrencyCircleDollar} color="var(--success)" href="/reports"
          delta={revenueChange ? `${revenueChange > 0 ? "+" : ""}${Math.round(revenueChange * 100)}%` : undefined} positive={revenueChange >= 0} delay={0} />
        <KPICard label="Lead nóng" value={stats?.hotLeads ?? 0} icon={Flame} color="var(--danger)" href="/sale" delay={40} />
        <KPICard label="Lên lịch" value={stats?.scheduled ?? 0} icon={CalendarBlank} color="var(--premium)" href="/publish" delay={80} />
        <KPICard label="Tin nhắn" value={stats?.unreadMessages ?? 0} icon={ChatCircleDots} color="var(--blue)" href="/inbox" delay={120} />
        <KPICard label="Đã đăng" value={stats?.publishedThisMonth ?? 0} icon={PaperPlaneTilt} color="var(--accent)" href="/library" delay={160} />
        <KPICard label="Cảnh báo" value={stats?.unreadAlerts ?? 0} icon={Bell} color="var(--warning)" href="/listening" delay={200} />
      </div>

      {/* ── ROW 1: AI · Pipeline · Tasks ────────────────────── */}
      <div className="ceo-row-3 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard title="AI Team Status" icon={Robot} iconColor="var(--premium)" topColor="var(--premium)" href="/orchestrator" hrefLabel="Orchestrator">
          <AITeamStatus />
        </SectionCard>

        <SectionCard title="Lead Pipeline" icon={Flame} iconColor="var(--danger)" topColor="var(--danger)" href="/sale" hrefLabel="Chi tiết">
          <LeadPipeline />
        </SectionCard>

        <SectionCard title="CEO Task Center" icon={Sparkle} iconColor="var(--premium)" topColor="var(--premium)">
          <CEOTaskCenter />
        </SectionCard>
      </div>

      {/* ── ROW 2: Content · Ads · Leads ────────────────────── */}
      <div className="ceo-row-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SectionCard title="Content Factory" icon={PaperPlaneTilt} iconColor="var(--accent)" topColor="var(--accent)" href="/publish" hrefLabel="Lịch đăng">
          <ContentFactory />
        </SectionCard>

        <SectionCard title="Ads Command Center" icon={TrendUp} iconColor="var(--blue)" topColor="var(--blue)" href="/analytics" hrefLabel="Analytics">
          <AdsCommandCenter />
        </SectionCard>

        <SectionCard title="Lead nóng" icon={Flame} iconColor="var(--danger)" topColor="var(--danger)" href="/sale" hrefLabel="Follow-up">
          <HotLeads />
        </SectionCard>
      </div>

    </div>
  );
}
