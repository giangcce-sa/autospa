"use client";

import { useEffect, useState, useCallback } from "react";
import { DashboardMetric, DashboardPanel } from "@/components/dashboard/Dashboard";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Crown, Warning, TrendUp, Users, ArrowsClockwise, Phone } from "@phosphor-icons/react";

import type { CustomerCLVSummaryData } from "@/lib/customer-clv";

type Summary = CustomerCLVSummaryData;

const TIER_META: Record<string, { label: string; color: string }> = {
  premium: { label: "Premium", color: "var(--premium)" },
  high:    { label: "High",    color: "var(--success)" },
  mid:     { label: "Mid",     color: "var(--blue)" },
  low:     { label: "Low",     color: "var(--text-muted)" },
};

const CHURN_META: Record<string, { label: string; color: string }> = {
  high:   { label: "Nguy hiểm", color: "var(--danger)" },
  medium: { label: "Cảnh báo",  color: "var(--warning)" },
  low:    { label: "Ổn định",   color: "var(--success)" },
};

function vnd(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}tr`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

function RFMBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <div key={i} className="w-2 h-2 rounded-sm" style={{ background: i <= value ? color : "var(--border)" }} />
      ))}
    </div>
  );
}

export function CLVDashboard({ initialSummary, canMutate = true }: { initialSummary?: Summary; canMutate?: boolean } = {}) {
  const [summary, setSummary] = useState<Summary | null>(initialSummary ?? null);
  const [loading, setLoading] = useState(!initialSummary);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<"top" | "risk">("top");

  const load = useCallback(async () => {
    const res = await fetch("/api/crm/insights");
    const json = await res.json();
    if (json.success) setSummary(json.data.summary);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!initialSummary) load();
  }, [initialSummary, load]);

  const refresh = async () => {
    setRefreshing(true);
    await fetch("/api/crm/insights", { method: "POST" });
    await load();
    setRefreshing(false);
  };

  if (loading) return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1,2,3,4].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}
      </div>
      <div className="skeleton h-64 rounded-xl" />
    </div>
  );

  if (!summary) return null;

  const displayList = tab === "top" ? summary.topCustomers : summary.atRisk;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <DashboardMetric label="TB CLV / khách" value={`${vnd(summary.avgCLV)}đ`} detail="Booking-derived persisted" icon={TrendUp} />
        <DashboardMetric label="Premium + High" value={summary.tiers.premium + summary.tiers.high} detail="CLV tiers" icon={Crown} tone="warning" />
        <DashboardMetric label="Churn risk cao" value={summary.churn.high} detail="Derived from persisted bookings" icon={Warning} tone="danger" />
        <DashboardMetric label="Tổng khách" value={summary.total} detail="Có CLV summary" icon={Users} tone="info" />
      </div>

      <DashboardPanel title="Phân tầng CLV" description="Tỷ lệ trong tập Customer có summary hiện tại" action={undefined}>
        {canMutate ? <div className="mb-4 flex justify-end"><Button size="sm" variant="secondary" onClick={refresh} loading={refreshing}><ArrowsClockwise size={12} /> Cập nhật</Button></div> : null}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(["premium","high","mid","low"] as const).map(tier => {
            const meta = TIER_META[tier];
            const count = summary.tiers[tier];
            const pct = summary.total > 0 ? Math.round((count / summary.total) * 100) : 0;
            return (
              <div key={tier} className="rounded-xl p-3 text-center" style={{ background: meta.color + "10", border: `1px solid ${meta.color}30` }}>
                <p className="text-xl font-bold tabular-nums" style={{ color: meta.color }}>{count}</p>
                <p className="text-[10px] font-semibold" style={{ color: meta.color }}>{meta.label}</p>
                <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: meta.color }} />
                </div>
                <p className="text-[9px] mt-1" style={{ color: "var(--text-muted)" }}>{pct}%</p>
              </div>
            );
          })}
        </div>
      </DashboardPanel>

      {/* Customer list */}
      <Card>
        <CardHeader>
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: "var(--bg-subtle)" }}>
            {[{ key: "top", label: "Top CLV" }, { key: "risk", label: `🚨 Churn Risk (${summary.churn.high})` }].map(t => (
              <button key={t.key} type="button" aria-pressed={tab === t.key} onClick={() => setTab(t.key as "top" | "risk")}
                className="min-h-11 rounded-md px-3 py-1 text-[11px] font-medium transition-all"
                style={{
                  background: tab === t.key ? "var(--bg-card)" : "transparent",
                  color: tab === t.key ? "var(--text)" : "var(--text-muted)",
                  boxShadow: tab === t.key ? "var(--shadow-sm)" : "none",
                }}>
                {t.label}
              </button>
            ))}
          </div>
        </CardHeader>

        {displayList.length === 0 ? (
          <p className="text-xs text-center py-8" style={{ color: "var(--text-muted)" }}>
            {tab === "risk" ? "Không có khách nào có nguy cơ churn cao" : "Chưa có dữ liệu booking"}
          </p>
        ) : (
          <div className="space-y-2">
            {displayList.map((c, i) => {
              const tier = TIER_META[c.clvTier];
              const churn = CHURN_META[c.churnRisk];
              return (
                <div key={c.customerId} className="flex items-center gap-3 p-2.5 rounded-xl" style={{ background: "var(--bg-subtle)" }}>
                  {/* Rank */}
                  <span className="text-xs font-bold w-5 shrink-0 tabular-nums" style={{ color: i === 0 && tab === "top" ? "var(--premium)" : "var(--text-muted)" }}>
                    {tab === "top" ? `#${i+1}` : ""}
                  </span>

                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: tier.color + "20", color: tier.color }}>
                    {c.name.split(" ").slice(-1)[0][0]}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-semibold" style={{ color: "var(--text)" }}>{c.name}</p>
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: tier.color + "18", color: tier.color }}>
                        {tier.label}
                      </span>
                      {c.churnRisk !== "low" && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: churn.color + "18", color: churn.color }}>
                          {churn.label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-[10px] font-bold" style={{ color: tier.color }}>{vnd(c.clvTotal)}đ</span>
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{c.bookingCount} lần · TB {vnd(c.avgOrderValue)}đ</span>
                      {c.daysSinceLastBooking < 999 && (
                        <span className="text-[10px]" style={{ color: c.churnRisk === "high" ? "var(--danger)" : "var(--text-muted)" }}>
                          {c.daysSinceLastBooking}d chưa quay lại
                        </span>
                      )}
                    </div>
                    {/* RFM */}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>R</span>
                      <RFMBar value={c.rfm.r} color="var(--danger)" />
                      <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>F</span>
                      <RFMBar value={c.rfm.f} color="var(--accent)" />
                      <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>M</span>
                      <RFMBar value={c.rfm.m} color="var(--premium)" />
                    </div>
                    {c.upsellSuggestion && (
                      <p className="text-[10px] mt-1" style={{ color: "var(--blue)" }}>💡 {c.upsellSuggestion}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 shrink-0">
                    {c.phone && (
                      <a href={`tel:${c.phone}`} aria-label={`Gọi ${c.name}`} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg" style={{ background: "var(--accent-light)" }}>
                        <Phone size={13} weight="fill" style={{ color: "var(--accent)" }} />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
