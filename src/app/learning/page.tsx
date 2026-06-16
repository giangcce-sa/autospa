"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  Brain, ArrowsClockwise, Lightning, ChartBar, UsersThree,
  ArrowsSplit, Scales, TrendUp, TrendDown, Minus, CheckCircle,
  XCircle, Clock, Sparkle,
} from "@phosphor-icons/react";

interface ContentMemory {
  tone: string | null; postType: string | null;
  topKeywords: string; topHashtags: string;
  avgEngagement: number; sampleCount: number;
  bestHour: number | null; bestDayOfWeek: number | null;
  updatedAt: string;
}

interface SourceWeight {
  source: string; totalLeads: number; converted: number;
  conversionRate: number; avgRevenue: number; weight: number;
}

interface LearningInsight {
  id: string; loop: string; insight: string;
  confidence: number; appliedTo: string | null; createdAt: string;
}

interface BehaviorInsights {
  peakHours: { hour: number; label: string; count: number }[];
  popularServices: { service: string; count: number; revenue: number }[];
  peakDays: { day: number; label: string; count: number }[];
  bestPostingHour: number | null;
  topServiceForPromo: string | null;
}

interface Summary {
  contentMem: ContentMemory | null;
  sourceWeights: SourceWeight[];
  recentInsights: LearningInsight[];
  behavior: BehaviorInsights;
}

const LOOP_META: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  content: { icon: Sparkle, label: "Content Memory", color: "var(--accent)" },
  lead: { icon: UsersThree, label: "Lead Attribution", color: "var(--warning)" },
  ab: { icon: ArrowsSplit, label: "A/B Learning", color: "var(--premium)" },
  decision: { icon: Scales, label: "Decision Outcomes", color: "var(--rose)" },
  behavior: { icon: ChartBar, label: "Customer Behavior", color: "var(--amber)" },
};

const DAY_NAMES = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function WeightBar({ value, max = 3 }: { value: number; max?: number }) {
  const pct = Math.round((value / max) * 100);
  const color = value > 2 ? "var(--success)" : value > 1.2 ? "var(--warning)" : "var(--danger)";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-subtle)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[10px] w-6 tabular-nums font-semibold" style={{ color }}>{value.toFixed(1)}</span>
    </div>
  );
}

function StatusIcon({ status }: { status: string | null }) {
  if (status === "success") return <CheckCircle size={14} weight="fill" style={{ color: "var(--success)" }} />;
  if (status === "fail") return <XCircle size={14} weight="fill" style={{ color: "var(--danger)" }} />;
  if (status === "neutral") return <Minus size={14} weight="bold" style={{ color: "var(--text-muted)" }} />;
  return <Clock size={14} style={{ color: "var(--text-muted)" }} />;
}

export default function LearningPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [insights, setInsights] = useState<LearningInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, i] = await Promise.all([
      fetch("/api/learning").then((r) => r.json()),
      fetch("/api/learning?action=insights").then((r) => r.json()),
    ]);
    if (s.success) setSummary(s.data);
    if (i.success) setInsights(i.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const runNow = async () => {
    setRunning(true);
    setRunResult(null);
    const res = await fetch("/api/learning", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "run" }),
    });
    const json = await res.json();
    if (json.success) {
      const d = json.data;
      setRunResult(`Xong trong ${d.durationMs}ms · ${d.totalInsights} insight mới · Content: ${d.content.updated} bài · Lead: ${d.lead.updated} nguồn · A/B: ${d.ab.processed} test · Quyết định: ${d.decision.evaluated} · Behavior: ${d.behavior.updated} pattern`);
      load();
    }
    setRunning(false);
  };

  const mem = summary?.contentMem;
  const topKeywords: string[] = mem ? JSON.parse(mem.topKeywords || "[]") : [];
  const topHashtags: string[] = mem ? JSON.parse(mem.topHashtags || "[]") : [];

  return (
    <>
      <PageHeader
        title="AI Self-Learning"
        description="5 vòng lặp tự học — Content Memory · Lead Attribution · A/B Learning · Decision Outcomes · Customer Behavior"
      />

      <div className="space-y-4 max-w-5xl">
        {/* Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button onClick={runNow} loading={running}>
            <Brain size={14} weight="fill" /> Chạy tất cả learning loops
          </Button>
          <Button variant="secondary" onClick={load} loading={loading}>
            <ArrowsClockwise size={14} /> Làm mới
          </Button>
          {runResult && (
            <p className="text-[11px] flex-1" style={{ color: "var(--success)" }}>✓ {runResult}</p>
          )}
        </div>

        {/* Loop cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {Object.entries(LOOP_META).map(([key, meta]) => {
            const Icon = meta.icon;
            return (
              <div
                key={key}
                className="rounded-xl p-3 border flex flex-col items-center gap-1.5 text-center"
                style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${meta.color}18` }}>
                  <Icon size={16} weight="fill" style={{ color: meta.color }} />
                </div>
                <p className="text-[10px] font-semibold leading-tight" style={{ color: "var(--text)" }}>{meta.label}</p>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: `${meta.color}18`, color: meta.color }}>
                  Active
                </span>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Content Memory */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkle size={14} weight="fill" style={{ color: "var(--accent)" }} />
                Content Memory
              </CardTitle>
            </CardHeader>
            {loading ? (
              <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-6 rounded-lg" />)}</div>
            ) : mem ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-lg p-2" style={{ background: "var(--bg-subtle)" }}>
                    <p style={{ color: "var(--text-muted)" }}>Tone tốt nhất</p>
                    <p className="font-semibold mt-0.5" style={{ color: "var(--accent)" }}>{mem.tone ?? "—"}</p>
                  </div>
                  <div className="rounded-lg p-2" style={{ background: "var(--bg-subtle)" }}>
                    <p style={{ color: "var(--text-muted)" }}>Loại post</p>
                    <p className="font-semibold mt-0.5" style={{ color: "var(--accent)" }}>{mem.postType ?? "—"}</p>
                  </div>
                  <div className="rounded-lg p-2" style={{ background: "var(--bg-subtle)" }}>
                    <p style={{ color: "var(--text-muted)" }}>Giờ tốt nhất</p>
                    <p className="font-semibold mt-0.5" style={{ color: "var(--text)" }}>{mem.bestHour !== null ? `${mem.bestHour}:00` : "—"}</p>
                  </div>
                  <div className="rounded-lg p-2" style={{ background: "var(--bg-subtle)" }}>
                    <p style={{ color: "var(--text-muted)" }}>Ngày tốt nhất</p>
                    <p className="font-semibold mt-0.5" style={{ color: "var(--text)" }}>{mem.bestDayOfWeek !== null ? DAY_NAMES[mem.bestDayOfWeek] : "—"}</p>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold mb-1.5" style={{ color: "var(--text-muted)" }}>TỪ KHÓA HIỆU QUẢ</p>
                  <div className="flex flex-wrap gap-1">
                    {topKeywords.slice(0, 8).map((k) => (
                      <span key={k} className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--accent)18", color: "var(--accent)" }}>
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
                {topHashtags.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold mb-1.5" style={{ color: "var(--text-muted)" }}>HASHTAG</p>
                    <div className="flex flex-wrap gap-1">
                      {topHashtags.slice(0, 5).map((h) => (
                        <span key={h} className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}>
                          #{h}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-[9px]" style={{ color: "var(--text-muted)" }}>
                  Dựa trên {mem.sampleCount} bài · Avg engagement: {Math.round(mem.avgEngagement)}
                </p>
              </div>
            ) : (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Chưa có dữ liệu — chạy learning loop để phân tích</p>
            )}
          </Card>

          {/* Lead Attribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UsersThree size={14} weight="fill" style={{ color: "var(--warning)" }} />
                Lead Attribution
              </CardTitle>
            </CardHeader>
            {loading ? (
              <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-8 rounded-lg" />)}</div>
            ) : summary?.sourceWeights && summary.sourceWeights.length > 0 ? (
              <div className="space-y-2">
                {summary.sourceWeights.map((sw) => (
                  <div key={sw.source} className="space-y-0.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="font-medium" style={{ color: "var(--text)" }}>{sw.source}</span>
                      <span style={{ color: "var(--text-muted)" }}>
                        {sw.converted}/{sw.totalLeads} · {(sw.conversionRate * 100).toFixed(0)}%
                      </span>
                    </div>
                    <WeightBar value={sw.weight} />
                  </div>
                ))}
                <p className="text-[9px] pt-1" style={{ color: "var(--text-muted)" }}>
                  Weight 0-3: cao hơn = ưu tiên kênh trong chiến dịch
                </p>
              </div>
            ) : (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Chưa có dữ liệu lead</p>
            )}
          </Card>

          {/* Customer Behavior */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ChartBar size={14} weight="fill" style={{ color: "var(--amber)" }} />
                Customer Behavior
              </CardTitle>
            </CardHeader>
            {loading ? (
              <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-8 rounded-lg" />)}</div>
            ) : summary?.behavior ? (
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-semibold mb-1" style={{ color: "var(--text-muted)" }}>GIỜ CAO ĐIỂM</p>
                  <div className="flex flex-wrap gap-1.5">
                    {summary.behavior.peakHours.map((h, i) => (
                      <span key={h.hour} className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{
                        background: i === 0 ? "var(--amber)" : "var(--bg-subtle)",
                        color: i === 0 ? "white" : "var(--text)",
                      }}>
                        {h.label}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold mb-1" style={{ color: "var(--text-muted)" }}>DỊCH VỤ PHỔ BIẾN</p>
                  <div className="space-y-1">
                    {summary.behavior.popularServices.slice(0, 4).map((s, i) => (
                      <div key={s.service} className="flex items-center gap-2 text-[11px]">
                        <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
                          style={{ background: i === 0 ? "var(--accent)" : "var(--bg-subtle)", color: i === 0 ? "white" : "var(--text-muted)" }}>
                          {i + 1}
                        </span>
                        <span className="flex-1 truncate" style={{ color: "var(--text)" }}>{s.service}</span>
                        <span style={{ color: "var(--text-muted)" }}>{s.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold mb-1" style={{ color: "var(--text-muted)" }}>NGÀY CAO ĐIỂM</p>
                  <div className="flex gap-1.5">
                    {summary.behavior.peakDays.map((d, i) => (
                      <span key={d.day} className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{
                        background: i === 0 ? "var(--warning)" : "var(--bg-subtle)",
                        color: i === 0 ? "white" : "var(--text)",
                      }}>
                        {d.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Chưa có dữ liệu booking</p>
            )}
          </Card>

          {/* Recent insights log */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightning size={14} weight="fill" style={{ color: "var(--premium)" }} />
                Insight Log
              </CardTitle>
            </CardHeader>
            {loading ? (
              <div className="space-y-2">{[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-10 rounded-lg" />)}</div>
            ) : insights.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {insights.map((ins) => {
                  const meta = LOOP_META[ins.loop];
                  const Icon = meta?.icon ?? Lightning;
                  return (
                    <div key={ins.id} className="flex gap-2.5 p-2 rounded-lg" style={{ background: "var(--bg-subtle)" }}>
                      <Icon size={13} weight="fill" style={{ color: meta?.color ?? "var(--accent)", flexShrink: 0, marginTop: 1 }} />
                      <div className="min-w-0">
                        <p className="text-[11px] leading-snug" style={{ color: "var(--text)" }}>{ins.insight}</p>
                        <p className="text-[9px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                          {meta?.label} · {new Date(ins.createdAt).toLocaleDateString("vi-VN")} · confidence {Math.round(ins.confidence * 100)}%
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Chưa có insight — chạy learning loop</p>
            )}
          </Card>
        </div>

        {/* Decision outcomes */}
        <DecisionOutcomes />
      </div>
    </>
  );
}

function DecisionOutcomes() {
  const [decisions, setDecisions] = useState<{
    id: string; topic: string; outcomeStatus: string | null;
    outcomeBefore: number | null; outcomeAfter: number | null;
    outcomeMetric: string | null; outcomeNotes: string | null; createdAt: string;
  }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/learning?action=decisions")
      .then((r) => r.json())
      .then((j) => { if (j.success) setDecisions(j.data); setLoading(false); });
  }, []);

  if (loading) return <div className="skeleton h-32 rounded-xl" />;
  if (decisions.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scales size={14} weight="fill" style={{ color: "var(--rose)" }} />
          Decision Outcome Loop — Lịch sử quyết định CEO
        </CardTitle>
      </CardHeader>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr style={{ color: "var(--text-muted)" }}>
              <th className="text-left pb-2 font-semibold">Chủ đề</th>
              <th className="text-right pb-2 font-semibold">Metric</th>
              <th className="text-right pb-2 font-semibold">Trước</th>
              <th className="text-right pb-2 font-semibold">Sau</th>
              <th className="text-center pb-2 font-semibold">Kết quả</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
            {decisions.map((d) => {
              const delta = d.outcomeBefore && d.outcomeAfter
                ? ((d.outcomeAfter - d.outcomeBefore) / d.outcomeBefore) * 100
                : null;
              return (
                <tr key={d.id}>
                  <td className="py-2 pr-3 max-w-[200px]">
                    <p className="truncate" style={{ color: "var(--text)" }}>{d.topic}</p>
                    {d.outcomeNotes && (
                      <p className="text-[9px] truncate mt-0.5" style={{ color: "var(--text-muted)" }}>{d.outcomeNotes}</p>
                    )}
                  </td>
                  <td className="py-2 text-right" style={{ color: "var(--text-muted)" }}>{d.outcomeMetric ?? "—"}</td>
                  <td className="py-2 text-right tabular-nums" style={{ color: "var(--text)" }}>{d.outcomeBefore?.toLocaleString() ?? "—"}</td>
                  <td className="py-2 text-right tabular-nums" style={{ color: "var(--text)" }}>
                    {d.outcomeAfter ? (
                      <span>
                        {d.outcomeAfter.toLocaleString()}
                        {delta !== null && (
                          <span className="ml-1 text-[9px]" style={{ color: delta >= 0 ? "var(--success)" : "var(--danger)" }}>
                            {delta >= 0 ? <TrendUp size={9} className="inline" /> : <TrendDown size={9} className="inline" />}
                            {Math.abs(delta).toFixed(1)}%
                          </span>
                        )}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="py-2 text-center">
                    <StatusIcon status={d.outcomeStatus} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
