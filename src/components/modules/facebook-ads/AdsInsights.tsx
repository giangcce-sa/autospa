"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ArrowClockwise } from "@phosphor-icons/react";
import type { AdsInsights as Insights } from "@/lib/facebook-ads";

const DATE_PRESETS = [
  { label: "Hôm nay", value: "today" },
  { label: "7 ngày", value: "last_7d" },
  { label: "30 ngày", value: "last_30d" },
  { label: "Tháng này", value: "this_month" },
];

function fmt(n: string) { return Number(n).toLocaleString("vi-VN"); }
function fmtVnd(n: string) { return Number(n).toLocaleString("vi-VN") + "đ"; }

interface Props { facebookPageId?: string; }

export function AdsInsights({ facebookPageId }: Props) {
  const [datePreset, setDatePreset] = useState("last_7d");
  const [data, setData] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const url = `/api/facebook-ads?action=insights&datePreset=${datePreset}${facebookPageId ? `&facebookPageId=${facebookPageId}` : ""}`;
      const res = await fetch(url);
      const json = await res.json();
      if (!json.success) { setError(json.error); return; }
      setData(json.data);
    } finally { setLoading(false); }
  }, [datePreset, facebookPageId]);

  useEffect(() => { load(); }, [load]);

  const stats = data
    ? [
        { label: "Chi tiêu", value: fmtVnd(data.spend) },
        { label: "Reach", value: fmt(data.reach) },
        { label: "Impressions", value: fmt(data.impressions) },
        { label: "Clicks", value: fmt(data.clicks) },
        { label: "CTR", value: (Number(data.ctr) * 100).toFixed(2) + "%" },
        { label: "CPM", value: fmtVnd(data.cpm) },
        { label: "CPC", value: fmtVnd(data.cpc) },
      ]
    : [];

  return (
    <div className="space-y-4">
      {/* Date preset + refresh */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--bg-subtle)" }}>
          {DATE_PRESETS.map((d) => (
            <button
              key={d.value}
              onClick={() => setDatePreset(d.value)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: datePreset === d.value ? "var(--bg-card)" : "transparent",
                color: datePreset === d.value ? "var(--text)" : "var(--text-muted)",
                boxShadow: datePreset === d.value ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              }}
            >
              {d.label}
            </button>
          ))}
        </div>
        <Button size="sm" variant="secondary" loading={loading} onClick={load}>
          <ArrowClockwise size={13} /> Làm mới
        </Button>
      </div>

      {error && (
        <p className="text-xs p-3 rounded-lg" style={{ background: "var(--rose-light)", color: "var(--rose)" }}>{error}</p>
      )}

      {/* Stat cards */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map((s) => (
            <Card key={s.label}>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{s.label}</p>
              <p className="text-lg font-bold mt-0.5" style={{ color: "var(--text)" }}>{s.value}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Campaign breakdown */}
      {data && data.campaigns.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Theo chiến dịch</CardTitle></CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }}>
                  {["Chiến dịch", "Chi tiêu", "Reach", "Clicks", "Impressions", "CTR"].map((h) => (
                    <th key={h} className="text-left py-2 px-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.campaigns.map((c, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="py-2.5 px-2 font-medium max-w-[200px] truncate" style={{ color: "var(--text)" }}>{c.name || "—"}</td>
                    <td className="py-2.5 px-2" style={{ color: "var(--text-secondary)" }}>{fmtVnd(c.spend)}</td>
                    <td className="py-2.5 px-2" style={{ color: "var(--text-secondary)" }}>{fmt(c.reach)}</td>
                    <td className="py-2.5 px-2" style={{ color: "var(--text-secondary)" }}>{fmt(c.clicks)}</td>
                    <td className="py-2.5 px-2" style={{ color: "var(--text-secondary)" }}>{fmt(c.impressions)}</td>
                    <td className="py-2.5 px-2" style={{ color: "var(--text-secondary)" }}>{(Number(c.ctr) * 100).toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {data && data.campaigns.length === 0 && (
        <p className="text-xs text-center py-6" style={{ color: "var(--text-muted)" }}>Không có dữ liệu cho khoảng thời gian này.</p>
      )}
    </div>
  );
}
