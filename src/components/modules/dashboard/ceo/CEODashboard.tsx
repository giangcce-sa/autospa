"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowsClockwise,
  ArrowRight,
  Bell,
  CalendarBlank,
  ChartLineUp,
  ChatCircleDots,
  CheckCircle,
  CurrencyCircleDollar,
  Flame,
  Megaphone,
  PaperPlaneTilt,
  Robot,
  Target,
  WarningCircle,
} from "@phosphor-icons/react";
import { AITeamStatus } from "./AITeamStatus";
import { LeadPipeline } from "./LeadPipeline";
import { CEOTaskCenter } from "./CEOTaskCenter";
import { ContentFactory } from "./ContentFactory";
import { AdsCommandCenter } from "./AdsCommandCenter";
import { HotLeads } from "./HotLeads";

interface BriefData {
  summary: string;
  date: string;
}

interface Stats {
  publishedThisMonth: number;
  scheduled: number;
  unreadMessages: number;
  hotLeads: number;
  totalCustomers: number;
  unreadAlerts: number;
}

interface CommandCenterData {
  stats: Stats;
  kpis: {
    revenueToday: number;
    bookingsToday: number;
    leadsToday: number;
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

function vnd(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} tỷ`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} tr`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(Math.round(n));
}

function SectionCard({
  title,
  icon,
  iconColor,
  href,
  hrefLabel,
  children,
  className = "",
}: {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  href?: string;
  hrefLabel?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const Icon = icon;
  return (
    <section
      className={`ceo-section-card rounded-xl p-4 ${className}`}
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: iconColor + "18" }}>
            <Icon size={14} weight="fill" style={{ color: iconColor }} />
          </div>
          <h2 className="text-xs font-bold uppercase tracking-wider truncate" style={{ color: "var(--text)" }}>
            {title}
          </h2>
        </div>
        {href && (
          <Link
            href={href}
            className="flex items-center gap-0.5 text-[10px] transition-opacity hover:opacity-70 shrink-0"
            style={{ color: "var(--text-muted)" }}
          >
            {hrefLabel} <ArrowRight size={9} />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function KPICard({
  label,
  value,
  icon,
  color,
  href,
  sublabel,
  urgent,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  href: string;
  sublabel?: string;
  urgent?: boolean;
}) {
  const Icon = icon;
  return (
    <Link
      href={href}
      className="ceo-kpi-card rounded-xl p-3 relative overflow-hidden group"
      style={{
        background: urgent ? `${color}0d` : "var(--bg-card)",
        border: `1px solid ${urgent ? color : "var(--border)"}`,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-2xl font-black tabular-nums leading-none" style={{ color: "var(--text)" }}>{value}</p>
          <p className="text-[10px] mt-1 leading-tight" style={{ color: "var(--text-muted)" }}>{label}</p>
          {sublabel && <p className="text-[9px] mt-1 truncate" style={{ color }}>{sublabel}</p>}
        </div>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: color + "18" }}>
          <Icon size={16} weight="fill" style={{ color }} />
        </div>
      </div>
    </Link>
  );
}

export function CEODashboard() {
  const [brief, setBrief] = useState<BriefData | null>(null);
  const [command, setCommand] = useState<CommandCenterData | null>(null);
  const [briefLoading, setBriefLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  const todayStr = useMemo(
    () => new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }),
    []
  );

  useEffect(() => {
    fetch("/api/morning-brief")
      .then((r) => r.json())
      .then((res) => {
        if (res.data) setBrief({ summary: res.data.summary, date: res.data.date });
      })
      .finally(() => setBriefLoading(false));

    fetch("/api/dashboard/command-center")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setCommand(res.data);
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
    } finally {
      setRegenerating(false);
    }
  };

  const stats = command?.stats;
  const kpis = command?.kpis;
  const highlights = command?.highlights;
  const briefText = brief?.summary?.trim();

  return (
    <div className="space-y-4">
      <section
        className="ceo-row-1 rounded-xl p-5 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #0f3f2c 0%, #145239 48%, #0f2f26 100%)",
          boxShadow: "0 12px 28px rgba(15, 63, 44, 0.24)",
        }}
      >
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.35) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        <div className="relative grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5 items-stretch">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold" style={{ background: "rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.86)" }}>
                <Robot size={12} weight="fill" />
                CEO command briefing
              </span>
              <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.62)" }}>{todayStr}</span>
            </div>

            <h1 className="text-2xl md:text-3xl font-black leading-tight max-w-3xl" style={{ color: "white" }}>
              Điều hành marketing, sales và AI team trong một màn hình.
            </h1>

            {briefLoading ? (
              <div className="space-y-2 mt-4 max-w-3xl">
                {[0.82, 1, 0.66].map((w, i) => (
                  <div key={i} className="h-3 rounded-lg" style={{ width: `${w * 100}%`, background: "rgba(255,255,255,0.18)" }} />
                ))}
              </div>
            ) : (
              <p className="text-sm leading-relaxed mt-3 max-w-3xl" style={{ color: "rgba(255,255,255,0.82)" }}>
                {briefText ? `${briefText.slice(0, 260)}${briefText.length > 260 ? "..." : ""}` : "Chưa có brief hôm nay. Tạo brief để AI tổng hợp tình hình kinh doanh và việc cần xử lý."}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 mt-4">
              <button
                onClick={regenerateBrief}
                disabled={regenerating}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:translate-y-[-1px] active:scale-[0.98] disabled:opacity-50"
                style={{ background: "white", color: "#145239" }}
              >
                <ArrowsClockwise size={12} className={regenerating ? "animate-spin" : ""} />
                {regenerating ? "Đang tạo..." : "Tạo brief mới"}
              </button>
              <Link
                href="/orchestrator"
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:translate-y-[-1px]"
                style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.9)", border: "1px solid rgba(255,255,255,0.16)" }}
              >
                Mở Orchestrator <ArrowRight size={10} />
              </Link>
              <Link
                href="/council"
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:translate-y-[-1px]"
                style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.82)" }}
              >
                AI Council
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Việc gấp", value: kpis?.criticalTasks ?? 0, icon: WarningCircle, color: "var(--rose)" },
              { label: "Chờ duyệt", value: kpis?.pendingApprovals ?? 0, icon: CheckCircle, color: "var(--premium)" },
              { label: "Lead nóng", value: stats?.hotLeads ?? 0, icon: Flame, color: "var(--amber)" },
              { label: "Doanh thu", value: kpis?.revenueToday ? `${vnd(kpis.revenueToday)}đ` : "—", icon: CurrencyCircleDollar, color: "var(--success)" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.11)", border: "1px solid rgba(255,255,255,0.14)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <Icon size={15} weight="fill" style={{ color: item.color }} />
                    <span className="text-[9px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.54)" }}>Today</span>
                  </div>
                  <p className="text-2xl font-black tabular-nums leading-none" style={{ color: "white" }}>{item.value}</p>
                  <p className="text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.66)" }}>{item.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="ceo-row-2 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
        <KPICard label="Doanh thu hôm nay" value={kpis?.revenueToday ? `${vnd(kpis.revenueToday)}đ` : "—"} icon={CurrencyCircleDollar} color="var(--success)" href="/reports" sublabel={`${kpis?.bookingsToday ?? 0} booking paid`} />
        <KPICard label="Lead nóng" value={stats?.hotLeads ?? 0} icon={Flame} color="var(--rose)" href="/sale" urgent={(stats?.hotLeads ?? 0) > 0} />
        <KPICard label="Tin chưa đọc" value={stats?.unreadMessages ?? 0} icon={ChatCircleDots} color="var(--blue)" href="/inbox" urgent={(stats?.unreadMessages ?? 0) > 0} />
        <KPICard label="Lịch đăng hôm nay" value={highlights?.scheduledToday ?? 0} icon={CalendarBlank} color="var(--accent)" href="/publish" />
        <KPICard label="Content tháng này" value={stats?.publishedThisMonth ?? 0} icon={PaperPlaneTilt} color="var(--premium)" href="/library" />
        <KPICard label="Alert mở" value={highlights?.alerts ?? stats?.unreadAlerts ?? 0} icon={Bell} color="var(--danger)" href="/listening" urgent={(highlights?.alerts ?? 0) > 0} />
      </div>

      <div className="ceo-row-3 grid grid-cols-1 xl:grid-cols-[1.05fr_1fr_1.05fr] gap-4">
        <SectionCard title="CEO task center" icon={Target} iconColor="var(--premium)" href="/automation" hrefLabel="Duyệt việc">
          <CEOTaskCenter />
        </SectionCard>

        <SectionCard title="Lead pipeline" icon={ChartLineUp} iconColor="var(--rose)" href="/sale" hrefLabel="Pipeline">
          <LeadPipeline />
        </SectionCard>

        <SectionCard title="Lead nóng" icon={Flame} iconColor="var(--rose)" href="/sale" hrefLabel="Follow-up">
          <HotLeads />
        </SectionCard>
      </div>

      <div className="ceo-row-4 grid grid-cols-1 xl:grid-cols-[1fr_1fr_1fr] gap-4">
        <SectionCard title="Content factory" icon={PaperPlaneTilt} iconColor="var(--accent)" href="/publish" hrefLabel="Lịch đăng">
          <ContentFactory />
        </SectionCard>

        <SectionCard title="Ads command center" icon={Megaphone} iconColor="var(--blue)" href="/facebook-ads" hrefLabel="Ads">
          <AdsCommandCenter />
        </SectionCard>

        <SectionCard title="AI team status" icon={Robot} iconColor="var(--premium)" href="/orchestrator" hrefLabel="Orchestrator">
          <AITeamStatus />
        </SectionCard>
      </div>
    </div>
  );
}
