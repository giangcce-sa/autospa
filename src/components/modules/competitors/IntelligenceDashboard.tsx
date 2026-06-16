"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  Eye, TrendUp, ArrowsClockwise, FacebookLogo, MagnifyingGlass, Lightning,
} from "@phosphor-icons/react";
import { formatDateTime } from "@/lib/utils";

interface Signal {
  id: string;
  source: string;
  topic: string;
  volume: number;
  trend: string;
  fetchedAt: string;
}

interface Insight {
  summary: string;
  risingTopics: { topic: string; source: string; volume: number; trend: string }[];
  competitorSignals: string[];
  recommendations: string[];
}

const SOURCE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  fb_ads_library: { label: "FB Ads Library", icon: FacebookLogo, color: "var(--blue)" },
  google_trends: { label: "Google Trends", icon: MagnifyingGlass, color: "var(--rose)" },
  fb_competitor: { label: "FB Đối thủ", icon: FacebookLogo, color: "var(--accent)" },
  manual: { label: "Manual", icon: Eye, color: "var(--text-muted)" },
};

const TREND_META: Record<string, { label: string; color: string }> = {
  rising: { label: "↑ Tăng", color: "var(--accent)" },
  stable: { label: "→ Ổn", color: "var(--text-muted)" },
  falling: { label: "↓ Giảm", color: "var(--rose)" },
};

export function IntelligenceDashboard() {
  const [insight, setInsight] = useState<Insight | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [filterSource, setFilterSource] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/intelligence");
      const json = await res.json();
      if (json.success) {
        setInsight(json.data.insight);
        setSignals(json.data.signals);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const syncSource = async (source: string) => {
    setSyncing(source);
    try {
      const res = await fetch("/api/intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
      if (res.ok) await load();
    } finally { setSyncing(null); }
  };

  const filteredSignals = filterSource ? signals.filter((s) => s.source === filterSource) : signals;

  if (loading && !insight) return <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>Đang tổng hợp insight...</p>;

  return (
    <div className="space-y-4">
      {/* Big insight banner */}
      {insight && (
        <div
          className="rounded-2xl p-5 relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, var(--amber) 0%, #b45309 100%)",
            boxShadow: "0 4px 20px rgba(217,119,6,0.3)",
          }}
        >
          <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full opacity-10" style={{ background: "white" }} />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.2)" }}>
                <Eye size={18} weight="fill" color="white" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.8)" }}>Intelligence Agent</p>
                <p className="text-base font-bold leading-tight" style={{ color: "white" }}>Insight tuần này</p>
              </div>
              <button onClick={() => syncSource("all")} disabled={syncing === "all"}
                className="ml-auto p-1.5 rounded-lg transition-opacity hover:opacity-70"
                style={{ background: "rgba(255,255,255,0.15)", color: "white" }}>
                <ArrowsClockwise size={12} className={syncing === "all" ? "animate-spin" : ""} />
              </button>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.92)" }}>{insight.summary}</p>
            {insight.recommendations.length > 0 && (
              <div className="mt-3 space-y-1">
                {insight.recommendations.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs" style={{ color: "rgba(255,255,255,0.9)" }}>
                    <Lightning size={11} weight="fill" className="mt-0.5 shrink-0" />
                    <span>{r}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Source sync buttons */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(SOURCE_META).filter(([key]) => key !== "manual" && key !== "fb_competitor").map(([key, meta]) => {
          const Icon = meta.icon;
          return (
            <Button key={key} size="sm" variant="secondary" onClick={() => syncSource(key.replace("fb_", ""))} loading={syncing === key.replace("fb_", "")}>
              <Icon size={11} weight="fill" style={{ color: meta.color }} /> Sync {meta.label}
            </Button>
          );
        })}
      </div>

      {/* Rising topics */}
      {insight && insight.risingTopics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Topic đang tăng</CardTitle>
            <TrendUp size={14} style={{ color: "var(--accent)" }} weight="fill" />
          </CardHeader>
          <div className="space-y-2">
            {insight.risingTopics.map((t, idx) => (
              <div key={idx} className="flex items-center gap-3 p-2.5 rounded-lg" style={{ background: "var(--bg-subtle)" }}>
                <span className="text-[10px] font-bold w-5 text-center" style={{ color: "var(--accent)" }}>{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{t.topic}</p>
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{t.source} · volume {t.volume}</p>
                </div>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: "var(--accent)", color: "white" }}>↑</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* All signals table */}
      <Card>
        <CardHeader>
          <CardTitle>Tất cả signals ({signals.length})</CardTitle>
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: "var(--bg-subtle)" }}>
            <button
              onClick={() => setFilterSource(null)}
              className="text-[10px] px-2 py-0.5 rounded-md"
              style={filterSource === null ? { background: "var(--accent)", color: "white" } : { color: "var(--text-secondary)" }}
            >
              Tất cả
            </button>
            {Object.entries(SOURCE_META).filter(([key]) => key !== "manual").map(([key, meta]) => (
              <button
                key={key}
                onClick={() => setFilterSource(key)}
                className="text-[10px] px-2 py-0.5 rounded-md"
                style={filterSource === key ? { background: meta.color, color: "white" } : { color: "var(--text-secondary)" }}
              >
                {meta.label}
              </button>
            ))}
          </div>
        </CardHeader>
        {filteredSignals.length === 0 ? (
          <p className="text-xs text-center py-6" style={{ color: "var(--text-muted)" }}>
            Chưa có signal. Bấm "Sync" ở trên để fetch.
          </p>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {filteredSignals.slice(0, 30).map((s) => {
              const sm = SOURCE_META[s.source];
              const tm = TREND_META[s.trend];
              const Icon = sm?.icon ?? Eye;
              return (
                <div key={s.id} className="flex items-center gap-3 py-2.5">
                  <Icon size={12} weight="fill" style={{ color: sm?.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm" style={{ color: "var(--text)" }}>{s.topic}</p>
                    <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      {sm?.label ?? s.source} · {formatDateTime(s.fetchedAt)}
                    </p>
                  </div>
                  <span className="text-[10px] font-semibold" style={{ color: tm?.color }}>{tm?.label}</span>
                  <span className="text-[10px] tabular-nums" style={{ color: "var(--text-muted)" }}>
                    vol {Math.round(s.volume).toLocaleString("vi-VN")}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
