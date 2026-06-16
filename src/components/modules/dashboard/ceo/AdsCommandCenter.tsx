"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, TrendUp, TrendDown } from "@phosphor-icons/react";

interface AdsMetric {
  label: string;
  value: string;
  raw: number;
  goodThreshold: number;
  badThreshold: number;
  higherIsBetter: boolean;
  unit: string;
}

export function AdsCommandCenter() {
  const [metrics, setMetrics] = useState<AdsMetric[]>([]);
  const [spend, setSpend] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => r.json())
      .then((res) => {
        const d = res.data ?? {};
        const ctr = d.avgCtr ?? 0;
        const cpl = d.avgCpl ?? 0;
        const roas = d.avgRoas ?? 0;
        const reach = d.totalReach ?? 0;
        const totalSpend = d.totalSpend ?? 0;
        setSpend(totalSpend);
        setMetrics([
          {
            label: "CTR",
            value: ctr ? `${(ctr * 100).toFixed(2)}%` : "—",
            raw: ctr,
            goodThreshold: 0.02,
            badThreshold: 0.005,
            higherIsBetter: true,
            unit: "%",
          },
          {
            label: "CPL",
            value: cpl ? `${Math.round(cpl).toLocaleString("vi-VN")}đ` : "—",
            raw: cpl,
            goodThreshold: 50000,
            badThreshold: 200000,
            higherIsBetter: false,
            unit: "đ",
          },
          {
            label: "ROAS",
            value: roas ? `${roas.toFixed(1)}x` : "—",
            raw: roas,
            goodThreshold: 3,
            badThreshold: 1,
            higherIsBetter: true,
            unit: "x",
          },
          {
            label: "Reach",
            value: reach ? `${(reach / 1000).toFixed(1)}K` : "—",
            raw: reach,
            goodThreshold: 5000,
            badThreshold: 500,
            higherIsBetter: true,
            unit: "",
          },
        ]);
      })
      .catch(() => setMetrics([]))
      .finally(() => setLoading(false));
  }, []);

  function getStatus(m: AdsMetric): "good" | "ok" | "bad" {
    if (m.raw === 0) return "ok";
    if (m.higherIsBetter) {
      if (m.raw >= m.goodThreshold) return "good";
      if (m.raw < m.badThreshold) return "bad";
      return "ok";
    } else {
      if (m.raw <= m.goodThreshold) return "good";
      if (m.raw > m.badThreshold) return "bad";
      return "ok";
    }
  }

  const statusColor = { good: "var(--success)", ok: "var(--warning)", bad: "var(--danger)" };
  const statusBg = { good: "var(--success-light)", ok: "var(--warning-light)", bad: "var(--danger-light)" };
  const statusLabel = { good: "Tốt", ok: "Ổn", bad: "Cần xem" };

  if (loading) {
    return <div className="space-y-2">{[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-11 rounded-lg" />)}</div>;
  }

  return (
    <div className="space-y-2">
      {/* Spend header */}
      {spend > 0 && (
        <div className="rounded-lg px-3 py-2 flex items-center justify-between" style={{ background: "var(--bg-subtle)" }}>
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Chi phí Ads (tháng này)</span>
          <span className="text-sm font-bold tabular-nums" style={{ color: "var(--text)" }}>
            {spend >= 1_000_000 ? `${(spend / 1_000_000).toFixed(1)}tr` : `${Math.round(spend / 1000)}K`}đ
          </span>
        </div>
      )}

      {metrics.map((m) => {
        const s = getStatus(m);
        const isGood = s === "good";
        return (
          <div
            key={m.label}
            className="flex items-center gap-3 px-3 py-2 rounded-lg"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: statusBg[s] }}>
              {isGood
                ? <TrendUp size={12} weight="fill" style={{ color: statusColor[s] }} />
                : <TrendDown size={12} weight="fill" style={{ color: statusColor[s] }} />
              }
            </div>
            <span className="text-xs font-medium flex-1" style={{ color: "var(--text-secondary)" }}>{m.label}</span>
            <span className="text-sm font-bold tabular-nums" style={{ color: "var(--text)" }}>{m.value}</span>
            <span
              className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{ background: statusBg[s], color: statusColor[s] }}
            >
              {statusLabel[s]}
            </span>
          </div>
        );
      })}

      {metrics.length === 0 && (
        <p className="text-xs text-center py-3" style={{ color: "var(--text-muted)" }}>
          Chưa có dữ liệu quảng cáo
        </p>
      )}

      <Link href="/analytics" className="flex items-center justify-center gap-1 pt-1 text-[10px] hover:opacity-70 transition-opacity" style={{ color: "var(--text-muted)" }}>
        Xem phân tích đầy đủ <ArrowRight size={9} />
      </Link>
    </div>
  );
}
