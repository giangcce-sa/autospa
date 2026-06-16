"use client";

import { useEffect, useState } from "react";
import { Flame, Thermometer, Snowflake, CheckCircle } from "@phosphor-icons/react";

interface LeadStats {
  total: number;
  cold: number;
  warm: number;
  hot: number;
  closed: number;
  convRate: number;
  bySource: { source: string; count: number }[];
}

const STAGES = [
  { key: "cold" as const, label: "Lạnh", icon: Snowflake, color: "var(--blue)" },
  { key: "warm" as const, label: "Ấm", icon: Thermometer, color: "var(--amber)" },
  { key: "hot" as const, label: "Nóng", icon: Flame, color: "var(--danger)" },
  { key: "closed" as const, label: "Chốt", icon: CheckCircle, color: "var(--success)" },
];

const SOURCE_LABELS: Record<string, string> = {
  facebook: "Facebook",
  zalo: "Zalo",
  instagram: "Instagram",
  manual: "Nhập tay",
  organic: "Organic",
  ads: "Quảng cáo",
  referral: "Giới thiệu",
};

export function LeadConversionChart() {
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics?action=leads")
      .then((r) => r.json())
      .then((res) => { if (res.data) setStats(res.data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1,2,3,4].map(i => <div key={i} className="skeleton h-10 rounded-xl" />)}
      </div>
    );
  }

  if (!stats) return null;

  const maxCount = Math.max(stats.cold, stats.warm, stats.hot, stats.closed, 1);
  const topSources = [...stats.bySource].sort((a, b) => b.count - a.count).slice(0, 4);
  const maxSource = Math.max(...topSources.map(s => s.count), 1);

  return (
    <div className="space-y-4">
      {/* Conversion rate badge */}
      <div className="flex items-center gap-3">
        <div
          className="flex-1 rounded-xl px-3 py-2.5 text-center"
          style={{ background: "var(--success-light)", border: "1px solid var(--success)33" }}
        >
          <p className="text-2xl font-black tabular-nums" style={{ color: "var(--success)" }}>{stats.convRate}%</p>
          <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>Tỷ lệ chốt deal</p>
        </div>
        <div
          className="flex-1 rounded-xl px-3 py-2.5 text-center"
          style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
        >
          <p className="text-2xl font-black tabular-nums" style={{ color: "var(--text)" }}>{stats.total}</p>
          <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>Tổng leads</p>
        </div>
      </div>

      {/* Stage bars */}
      <div className="space-y-2">
        {STAGES.map((stage) => {
          const count = stats[stage.key];
          const pct = Math.round((count / maxCount) * 100);
          const Icon = stage.icon;
          return (
            <div key={stage.key} className="flex items-center gap-2">
              <Icon size={12} weight="fill" style={{ color: stage.color, flexShrink: 0 }} />
              <p className="text-[10px] w-10 shrink-0" style={{ color: "var(--text-muted)" }}>{stage.label}</p>
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-subtle)" }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, background: stage.color }}
                />
              </div>
              <span className="text-xs font-bold tabular-nums w-6 text-right" style={{ color: stage.color }}>{count}</span>
            </div>
          );
        })}
      </div>

      {/* By source */}
      {topSources.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Theo nguồn</p>
          <div className="space-y-1.5">
            {topSources.map((s) => (
              <div key={s.source} className="flex items-center gap-2">
                <p className="text-[10px] w-20 shrink-0 truncate" style={{ color: "var(--text-secondary)" }}>
                  {SOURCE_LABELS[s.source] ?? s.source}
                </p>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-subtle)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.round((s.count / maxSource) * 100)}%`, background: "var(--accent)" }}
                  />
                </div>
                <span className="text-[10px] tabular-nums w-5 text-right" style={{ color: "var(--text-muted)" }}>{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
