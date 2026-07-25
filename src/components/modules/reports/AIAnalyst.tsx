"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Robot, WarningCircle, CheckCircle, ArrowsClockwise } from "@phosphor-icons/react";

interface Report {
  summary: string;
  highlights: string[];
  anomalies: string[];
  metrics: Record<string, number | string>;
  timeframe: string;
}

export function AIAnalyst({ canMutate = true }: { canMutate?: boolean }) {
  const [timeframe, setTimeframe] = useState<"7d" | "30d">("7d");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    if (!canMutate) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/analytics-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeframe }),
      });
      const json = await response.json();
      if (response.ok && json.success) setReport(json.data);
      else setError(json.error ?? "Không thể tạo báo cáo");
    } finally {
      setLoading(false);
    }
  };

  if (!canMutate) {
    return <Card><p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>AI Analyst dùng dữ liệu cấp tài khoản và chỉ Owner được tạo báo cáo.</p></Card>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 p-1 rounded-lg" style={{ background: "var(--bg-subtle)" }}>
          {(["7d", "30d"] as const).map((value) => (
            <button
              key={value}
              onClick={() => setTimeframe(value)}
              className="text-[11px] font-medium px-2.5 py-1 rounded-md transition-all"
              style={timeframe === value ? { background: "var(--accent)", color: "white" } : { color: "var(--text-secondary)" }}
            >
              {value === "7d" ? "7 ngày" : "30 ngày"}
            </button>
          ))}
        </div>
        <button disabled={loading} onClick={load} className="text-xs flex items-center gap-1 disabled:opacity-50" style={{ color: "var(--text-muted)" }}>
          <ArrowsClockwise size={11} /> {report ? "Phân tích lại" : "Tạo phân tích"}
        </button>
      </div>

      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Phạm vi: toàn tài khoản. Nguồn doanh thu và CRM hiện chưa có Page provenance đầy đủ.</p>
      {error && <p className="text-xs" style={{ color: "var(--rose)" }}>{error}</p>}

      {loading ? (
        <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>Analytics Agent đang đọc số liệu...</p>
      ) : !report ? (
        <Card><p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>Chọn thời gian rồi nhấn “Tạo phân tích”.</p></Card>
      ) : (
        <>
          <div
            className="rounded-2xl p-5 relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, var(--blue) 0%, #1e4eb8 100%)",
              boxShadow: "0 4px 20px rgba(37,99,235,0.25)",
            }}
          >
            <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full opacity-10" style={{ background: "white" }} />
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.2)" }}>
                  <Robot size={18} weight="fill" color="white" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.7)" }}>Analytics Agent</p>
                  <p className="text-base font-bold leading-tight" style={{ color: "white" }}>Báo cáo {report.timeframe}</p>
                </div>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.92)" }}>{report.summary}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {Object.entries(report.metrics).map(([key, value]) => (
              <div key={key} className="rounded-xl p-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <p className="text-sm font-bold truncate" style={{ color: "var(--text)" }}>{value}</p>
                <p className="text-[9px] mt-0.5 uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{key}</p>
              </div>
            ))}
          </div>

          {report.highlights.length > 0 && (
            <Card>
              <CardHeader><div className="flex items-center gap-2"><CheckCircle size={14} weight="fill" style={{ color: "var(--accent)" }} /><CardTitle>Điểm sáng</CardTitle></div></CardHeader>
              <ul className="space-y-2">
                {report.highlights.map((highlight) => (
                  <li key={highlight} className="flex items-start gap-2 text-sm" style={{ color: "var(--text)" }}>
                    <span className="text-[10px] font-bold mt-1" style={{ color: "var(--accent)" }}>●</span><span>{highlight}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {report.anomalies.length > 0 && (
            <Card>
              <CardHeader><div className="flex items-center gap-2"><WarningCircle size={14} weight="fill" style={{ color: "var(--amber)" }} /><CardTitle>Bất thường cần chú ý</CardTitle></div></CardHeader>
              <ul className="space-y-2">
                {report.anomalies.map((anomaly) => (
                  <li key={anomaly} className="flex items-start gap-2 text-sm rounded-lg p-2" style={{ background: "var(--amber-light)", color: "var(--amber)" }}>
                    <WarningCircle size={12} weight="fill" className="mt-0.5 shrink-0" /><span>{anomaly}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
