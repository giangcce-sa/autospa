"use client";

import { useEffect, useState } from "react";
import { TrendUp, TrendDown } from "@phosphor-icons/react";

interface Day {
  date: string;
  label: string;
  engagement: number;
  reach: number;
  posts: number;
  ctr: number;
}

type Metric = "engagement" | "reach" | "ctr";

export function EngagementTrend() {
  const [trend, setTrend] = useState<Day[]>([]);
  const [metric, setMetric] = useState<Metric>("engagement");
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<{ day: Day; x: number } | null>(null);

  useEffect(() => {
    fetch("/api/analytics?action=trend")
      .then((r) => r.json())
      .then((res) => { if (res.data) setTrend(res.data.trend); })
      .finally(() => setLoading(false));
  }, []);

  const METRICS: { key: Metric; label: string; color: string }[] = [
    { key: "engagement", label: "Tương tác", color: "var(--accent)" },
    { key: "reach", label: "Tiếp cận", color: "var(--blue)" },
    { key: "ctr", label: "CTR %", color: "var(--amber)" },
  ];

  const active = METRICS.find((m) => m.key === metric)!;
  const values = trend.map((d) => d[metric]);
  const max = Math.max(...values, 1);

  // show only every 5th label to avoid crowding
  const showLabel = (i: number) => i === 0 || i === trend.length - 1 || i % 5 === 0;

  // weekly delta: last 7 vs prev 7
  const last7 = trend.slice(-7).reduce((s, d) => s + d[metric], 0);
  const prev7 = trend.slice(-14, -7).reduce((s, d) => s + d[metric], 0);
  const delta = prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 100) : null;
  const positive = delta !== null && delta >= 0;

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex gap-2">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-7 w-20 rounded-lg" />)}
        </div>
        <div className="skeleton h-36 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Metric tabs + delta badge */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1 p-1 rounded-lg" style={{ background: "var(--bg-subtle)" }}>
          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-all"
              style={{
                background: metric === m.key ? "var(--bg-card)" : "transparent",
                color: metric === m.key ? m.color : "var(--text-muted)",
                boxShadow: metric === m.key ? "var(--shadow-sm)" : "none",
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
        {delta !== null && (
          <span
            className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: positive ? "var(--success-light)" : "var(--danger-light)",
              color: positive ? "var(--success)" : "var(--danger)",
            }}
          >
            {positive ? <TrendUp size={10} /> : <TrendDown size={10} />}
            {positive ? "+" : ""}{delta}% so với tuần trước
          </span>
        )}
      </div>

      {/* Bar chart */}
      <div
        className="relative h-36"
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Y-axis grid lines */}
        {[0.25, 0.5, 0.75, 1].map((pct) => (
          <div
            key={pct}
            className="absolute left-0 right-0 border-t"
            style={{ bottom: `${pct * 100}%`, borderColor: "var(--border)", opacity: 0.5 }}
          />
        ))}

        {/* Bars */}
        <div className="absolute inset-0 flex items-end gap-px">
          {trend.map((day, i) => {
            const h = max > 0 ? (day[metric] / max) * 100 : 0;
            return (
              <div
                key={day.date}
                className="flex-1 flex flex-col items-center justify-end group cursor-pointer"
                style={{ height: "100%" }}
                onMouseEnter={(e) => setTooltip({ day, x: e.currentTarget.getBoundingClientRect().left })}
              >
                <div
                  className="w-full rounded-t-sm transition-all duration-300 group-hover:opacity-100"
                  style={{
                    height: `${Math.max(h, day[metric] > 0 ? 4 : 0)}%`,
                    background: tooltip?.day.date === day.date
                      ? active.color
                      : `color-mix(in srgb, ${active.color} 60%, transparent)`,
                    minHeight: day[metric] > 0 ? 3 : 0,
                  }}
                />
                {showLabel(i) && (
                  <p className="text-[8px] mt-1 tabular-nums" style={{ color: "var(--text-muted)" }}>
                    {day.label}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute z-10 rounded-xl px-3 py-2 text-[10px] pointer-events-none"
            style={{
              bottom: "calc(100% + 8px)",
              left: "50%",
              transform: "translateX(-50%)",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
              minWidth: 120,
            }}
          >
            <p className="font-semibold mb-1" style={{ color: "var(--text)" }}>{tooltip.day.label}</p>
            <div className="space-y-0.5" style={{ color: "var(--text-muted)" }}>
              <p>Tương tác: <span className="font-medium" style={{ color: "var(--accent)" }}>{tooltip.day.engagement}</span></p>
              <p>Tiếp cận: <span className="font-medium" style={{ color: "var(--blue)" }}>{tooltip.day.reach.toLocaleString("vi-VN")}</span></p>
              <p>CTR: <span className="font-medium" style={{ color: "var(--amber)" }}>{tooltip.day.ctr}%</span></p>
              {tooltip.day.posts > 0 && <p>{tooltip.day.posts} bài đăng</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
