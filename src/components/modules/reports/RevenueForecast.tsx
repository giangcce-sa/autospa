"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TrendUp, Calendar, ChatsTeardrop, Sparkle, Lightning } from "@phosphor-icons/react";

interface ForecastDay {
  date: string;
  predicted: number;
  lowerBound: number;
  upperBound: number;
  factors: string[];
}

interface ForecastResult {
  days: ForecastDay[];
  total: number;
  confidence: number;
  notes: string;
  scenario: string;
  horizonDays: number;
}

const SCENARIOS = [
  { value: "baseline", label: "Bình thường", icon: "▪" },
  { value: "ads_2x", label: "Tăng ads 2x", icon: "📈" },
  { value: "promo_30", label: "Giảm 30%", icon: "🏷️" },
  { value: "tet_boost", label: "Mùa Tết", icon: "🎉" },
];

const HORIZONS = [7, 30, 90];

function vnd(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + "đ";
}

function vndShort(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}tỷ`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}tr`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(Math.round(n));
}

export function RevenueForecast() {
  const [horizonDays, setHorizonDays] = useState(30);
  const [scenario, setScenario] = useState("baseline");
  const [data, setData] = useState<ForecastResult | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/forecast?days=${horizonDays}&scenario=${scenario}`);
      const json = await res.json();
      if (json.success) setData(json.data);
    } finally { setLoading(false); }
  }, [horizonDays, scenario]);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) {
    return <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>Đang dự báo...</p>;
  }

  if (!data) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <TrendUp size={36} className="mb-3 opacity-20" style={{ color: "var(--text-secondary)" }} weight="fill" />
          <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>Không thể dự báo</p>
        </div>
      </Card>
    );
  }

  // Compute chart dimensions
  const maxPred = Math.max(...data.days.map((d) => d.upperBound));
  const minPred = Math.min(...data.days.map((d) => d.lowerBound));
  const range = maxPred - minPred || 1;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1 p-1 rounded-lg" style={{ background: "var(--bg-subtle)" }}>
          {HORIZONS.map((d) => (
            <button
              key={d}
              onClick={() => setHorizonDays(d)}
              className="text-[11px] font-medium px-2.5 py-1 rounded-md transition-all"
              style={horizonDays === d ? { background: "var(--accent)", color: "white" } : { color: "var(--text-secondary)" }}
            >
              {d} ngày
            </button>
          ))}
        </div>
        <div className="flex gap-1 p-1 rounded-lg" style={{ background: "var(--bg-subtle)" }}>
          {SCENARIOS.map((s) => (
            <button
              key={s.value}
              onClick={() => setScenario(s.value)}
              className="text-[11px] font-medium px-2.5 py-1 rounded-md transition-all"
              style={scenario === s.value ? { background: "var(--accent)", color: "white" } : { color: "var(--text-secondary)" }}
            >
              {s.icon} {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-2" style={{ background: "var(--accent-light)" }}>
            <TrendUp size={14} weight="fill" style={{ color: "var(--accent)" }} />
          </div>
          <p className="text-xl font-bold" style={{ color: "var(--text)" }}>{vnd(data.total)}</p>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Tổng dự báo {horizonDays} ngày</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-2" style={{ background: "var(--blue-light)" }}>
            <Calendar size={14} weight="fill" style={{ color: "var(--blue)" }} />
          </div>
          <p className="text-xl font-bold" style={{ color: "var(--text)" }}>{vnd(data.total / horizonDays)}</p>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Trung bình mỗi ngày</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-2" style={{ background: "var(--amber-light)" }}>
            <Lightning size={14} weight="fill" style={{ color: "var(--amber)" }} />
          </div>
          <p className="text-xl font-bold" style={{ color: "var(--text)" }}>{Math.round(data.confidence * 100)}%</p>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Độ tin cậy</p>
        </div>
      </div>

      {/* Bar chart */}
      <Card>
        <CardHeader>
          <CardTitle>Biểu đồ dự báo theo ngày</CardTitle>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Hover để xem chi tiết</p>
        </CardHeader>
        <div className="overflow-x-auto">
          <div
            className="flex items-end gap-0.5 h-40 px-1"
            style={{ minWidth: Math.max(data.days.length * 12, 400) }}
          >
            {data.days.map((d, idx) => {
              const heightPct = ((d.predicted - minPred) / range) * 100;
              const todayDate = new Date(d.date);
              const isWeekend = todayDate.getDay() === 0 || todayDate.getDay() === 6;
              const hasHoliday = d.factors.some((f) => !f.includes("CN") && !f.includes("T2") && !f.includes("T3") && !f.includes("T4") && !f.includes("T5") && !f.includes("T6") && !f.includes("T7") && !f.includes("scenario"));

              return (
                <div
                  key={idx}
                  className="flex-1 relative group cursor-pointer"
                  style={{ minWidth: 8 }}
                  title={`${d.date}: ${vnd(d.predicted)}\n${d.factors.join(" · ")}`}
                >
                  <div
                    className="rounded-t transition-opacity hover:opacity-80"
                    style={{
                      height: `${Math.max(heightPct, 5)}%`,
                      background: hasHoliday ? "var(--amber)" : isWeekend ? "var(--accent)" : "var(--accent-hover)",
                      opacity: hasHoliday ? 1 : 0.85,
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3 text-[10px]" style={{ color: "var(--text-muted)" }}>
          <span className="inline-flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "var(--accent-hover)" }} />
            Ngày thường
          </span>
          <span className="inline-flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "var(--accent)" }} />
            Cuối tuần
          </span>
          <span className="inline-flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "var(--amber)" }} />
            Ngày lễ
          </span>
        </div>
      </Card>

      {/* AI Council notes */}
      <Card>
        <CardHeader>
          <CardTitle>Phân tích từ AI Council</CardTitle>
          <ChatsTeardrop size={14} style={{ color: "var(--accent)" }} weight="fill" />
        </CardHeader>
        <div className="rounded-xl p-4 text-sm leading-relaxed whitespace-pre-wrap" style={{ background: "var(--accent-light)", color: "var(--text)" }}>
          {data.notes}
        </div>
      </Card>

      {/* Top days */}
      <Card>
        <CardHeader>
          <CardTitle>5 ngày doanh thu cao nhất</CardTitle>
          <Sparkle size={14} style={{ color: "var(--amber)" }} weight="fill" />
        </CardHeader>
        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
          {[...data.days].sort((a, b) => b.predicted - a.predicted).slice(0, 5).map((d, idx) => (
            <div key={d.date} className="flex items-start gap-3 py-3">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5"
                style={{ background: idx === 0 ? "var(--amber)" : "var(--bg-subtle)", color: idx === 0 ? "white" : "var(--text-muted)" }}
              >
                {idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
                  {new Date(d.date).toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "numeric" })}
                </p>
                {d.factors.length > 0 && (
                  <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{d.factors.join(" · ")}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold" style={{ color: "var(--accent)" }}>{vndShort(d.predicted)}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <p className="text-[10px] text-center" style={{ color: "var(--text-muted)" }}>
        Dự báo dựa trên BookingRevenue 90 ngày + seasonality + holiday + AI validation. Cập nhật khi có dữ liệu mới.
      </p>
    </div>
  );
}
