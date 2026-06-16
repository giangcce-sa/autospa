"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import {
  Robot, ArrowsClockwise, ArrowRight, Lightning, CurrencyCircleDollar,
  Users, ChatCircle, Megaphone, Eye, Warning, Sparkle, TrendUp, CheckCircle,
  TreeStructure, CaretDown, Bell,
} from "@phosphor-icons/react";
import { formatDateTime } from "@/lib/utils";

interface Signals {
  revenue: { last7: number; prev7: number; deltaPct: number };
  leads: { hotUnclosed: number; coldNoNurture: number; newToday: number };
  inbox: { unread: number };
  comments: { negativeUnreplied: number };
  approvals: { pendingOver24h: number };
  posts: { scheduledTomorrow: number };
  competitor: { surgeCount: number };
  forecast: { next7Predicted: number; vsAverage: number };
}

interface Priority {
  agent: string;
  score: number;
  reason: string;
  recommendedAction: string;
}

interface Action {
  agent: string;
  action: string;
  status: "executed" | "queued" | "skipped";
}

interface Plan {
  signals: Signals;
  priorities: Priority[];
  actions: Action[];
  mode: string;
}

const AGENT_META: Record<string, { label: string; href: string; icon: React.ElementType }> = {
  ads_creative: { label: "Ads Creative", href: "/facebook-ads", icon: Megaphone },
  proactive_sales: { label: "Proactive Sales", href: "/sale", icon: Users },
  content_research: { label: "Content Research", href: "/content-research", icon: Sparkle },
  intelligence: { label: "Intelligence", href: "/competitors", icon: Eye },
  promotion: { label: "Promotion", href: "/promotions", icon: Lightning },
  inbox_rules: { label: "Inbox Rules", href: "/inbox", icon: ChatCircle },
  approval_review: { label: "Approval", href: "/automation", icon: Warning },
};

function vnd(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}tr`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(Math.round(n));
}

interface Quota {
  key: string;
  used: number;
  limit: number;
  pct: number;
  windowEndsIn: number;
}

interface RealtimeAlert {
  id: string;
  type: string;
  signal: string;
  severity: string;
  acknowledged: boolean;
  detectedAt: string;
  workflowRunId: string | null;
}

interface WorkflowSummary {
  id: string;
  name: string;
  trigger: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  plan: string | null;
}

const WORKFLOW_META: Record<string, { label: string; color: string }> = {
  revenue_drop: { label: "Doanh thu giảm", color: "var(--rose)" },
  competitor_surge: { label: "Đối thủ viral", color: "var(--amber)" },
  engagement_drop: { label: "Engagement giảm", color: "var(--blue)" },
};

export function OrchestratorView() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [runAt, setRunAt] = useState<string | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [expandedWf, setExpandedWf] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<RealtimeAlert[]>([]);
  const [unackCount, setUnackCount] = useState(0);
  const [monitoring, setMonitoring] = useState(false);
  const [quotas, setQuotas] = useState<Quota[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [triggering, setTriggering] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [orcRes, wfRes, alertRes, quotaRes] = await Promise.all([
        fetch("/api/orchestrator").then((r) => r.json()),
        fetch("/api/workflows").then((r) => r.json()),
        fetch("/api/realtime-alerts").then((r) => r.json()),
        fetch("/api/rate-limit").then((r) => r.json()),
      ]);
      if (orcRes.success) {
        setPlan(orcRes.data.plan);
        setRunAt(orcRes.data.runAt ?? null);
      }
      if (wfRes.success) setWorkflows(wfRes.data);
      if (alertRes.success) {
        setAlerts(alertRes.data.alerts);
        setUnackCount(alertRes.data.unack);
      }
      if (quotaRes.success) setQuotas(quotaRes.data);
    } finally { setLoading(false); }
  }, []);

  const runMonitor = async () => {
    setMonitoring(true);
    try {
      await fetch("/api/realtime-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run-now" }),
      });
      await load();
    } finally { setMonitoring(false); }
  };

  const ackAlert = async (id: string) => {
    await fetch("/api/realtime-alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "acknowledge", id }),
    });
    await load();
  };

  useEffect(() => { load(); }, [load]);

  const triggerWorkflow = async (name: string) => {
    setTriggering(name);
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, trigger: `Manual trigger from /orchestrator` }),
      });
      const data = await res.json();
      if (data.success) await load();
    } finally { setTriggering(null); }
  };

  const runNow = async () => {
    setRunning(true);
    try {
      const res = await fetch("/api/orchestrator", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        setPlan(json.data);
        setRunAt(new Date().toISOString());
      }
    } finally { setRunning(false); }
  };

  if (loading && !plan) return <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>Đang phân tích state hệ thống...</p>;
  if (!plan) return <p className="text-sm text-center py-8" style={{ color: "var(--rose)" }}>Không tải được</p>;

  const s = plan.signals;
  const revUp = s.revenue.deltaPct > 0;

  return (
    <div className="space-y-5">
      {/* Header strip */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider"
            style={plan.mode === "auto"
              ? { background: "var(--accent)", color: "white" }
              : { background: "var(--bg-subtle)", color: "var(--text-secondary)" }}>
            Mode: {plan.mode === "auto" ? "Tự động" : "Đề xuất"}
          </span>
          {runAt && (
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              Cập nhật: {formatDateTime(runAt)}
            </span>
          )}
        </div>
        <Button onClick={runNow} loading={running} variant="secondary" size="sm">
          <ArrowsClockwise size={12} /> Re-run orchestrator
        </Button>
      </div>

      {/* Realtime alerts banner (only if any) */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell size={14} weight="fill" style={{ color: unackCount > 0 ? "var(--rose)" : "var(--accent)" }} />
              <CardTitle>Realtime Alerts {unackCount > 0 && `(${unackCount} mới)`}</CardTitle>
            </div>
            <button onClick={runMonitor} disabled={monitoring} className="text-xs flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
              <ArrowsClockwise size={11} className={monitoring ? "animate-spin" : ""} /> Check now
            </button>
          </CardHeader>
          <div className="space-y-2">
            {alerts.slice(0, 5).map((a) => {
              const severityColor = a.severity === "critical" ? "var(--rose)" : "var(--amber)";
              return (
                <div
                  key={a.id}
                  className="flex items-start gap-3 p-2.5 rounded-lg"
                  style={{
                    background: a.acknowledged ? "var(--bg-subtle)" : severityColor + "1A",
                    borderLeft: `2px solid ${severityColor}`,
                    opacity: a.acknowledged ? 0.6 : 1,
                  }}
                >
                  <Bell size={12} weight="fill" style={{ color: severityColor, marginTop: 2 }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold uppercase" style={{ color: severityColor }}>
                        {a.severity} · {a.type}
                      </span>
                      {a.workflowRunId && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--accent)", color: "white" }}>
                          Workflow đã trigger
                        </span>
                      )}
                    </div>
                    <p className="text-xs leading-snug mt-0.5" style={{ color: "var(--text)" }}>{a.signal}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{formatDateTime(a.detectedAt)}</p>
                  </div>
                  {!a.acknowledged && (
                    <button onClick={() => ackAlert(a.id)} className="text-[10px] px-2 py-1 rounded-lg"
                      style={{ background: "var(--bg-card)", color: "var(--text-secondary)" }}>
                      Đã xem
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Signal cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl p-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <CurrencyCircleDollar size={13} weight="fill" style={{ color: revUp ? "var(--accent)" : "var(--rose)" }} />
          <p className="text-lg font-bold mt-1" style={{ color: "var(--text)" }}>{vnd(s.revenue.last7)}đ</p>
          <p className="text-[10px]" style={{ color: revUp ? "var(--accent)" : "var(--rose)" }}>
            {revUp ? "↑" : "↓"} {Math.abs(Math.round(s.revenue.deltaPct * 100))}% vs 7d trước
          </p>
        </div>
        <div className="rounded-xl p-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <TrendUp size={13} weight="fill" style={{ color: "var(--blue)" }} />
          <p className="text-lg font-bold mt-1" style={{ color: "var(--text)" }}>{vnd(s.forecast.next7Predicted)}đ</p>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Forecast 7d tới</p>
        </div>
        <div className="rounded-xl p-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <Users size={13} weight="fill" style={{ color: "var(--rose)" }} />
          <p className="text-lg font-bold mt-1" style={{ color: "var(--text)" }}>{s.leads.hotUnclosed}</p>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Lead nóng chưa chốt</p>
        </div>
        <div className="rounded-xl p-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <Eye size={13} weight="fill" style={{ color: "var(--amber)" }} />
          <p className="text-lg font-bold mt-1" style={{ color: "var(--text)" }}>{s.competitor.surgeCount}</p>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Đối thủ viral 7d</p>
        </div>
      </div>

      {/* Priorities */}
      <Card>
        <CardHeader>
          <CardTitle>Ưu tiên hiện tại</CardTitle>
          <Robot size={15} style={{ color: "var(--accent)" }} weight="fill" />
        </CardHeader>
        {plan.priorities.length === 0 ? (
          <div className="flex items-center gap-2 py-4 text-sm" style={{ color: "var(--accent)" }}>
            <CheckCircle size={14} weight="fill" /> Mọi việc đều ổn — không có agent nào cần kích hoạt khẩn cấp
          </div>
        ) : (
          <div className="space-y-2">
            {plan.priorities.map((p, idx) => {
              const meta = AGENT_META[p.agent];
              const Icon = meta?.icon ?? Robot;
              const colorByScore = p.score >= 80 ? "var(--rose)" : p.score >= 65 ? "var(--amber)" : "var(--accent)";
              return (
                <Link
                  key={`${p.agent}-${idx}`}
                  href={meta?.href ?? "/"}
                  className="flex items-start gap-3 p-3 rounded-xl transition-all hover:-translate-y-px"
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                    style={{ background: colorByScore + "22", color: colorByScore }}
                  >
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <Icon size={13} weight="fill" style={{ color: colorByScore }} />
                      <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>{meta?.label ?? p.agent}</p>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: colorByScore, color: "white" }}>
                        {p.score}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{p.reason}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>→ {p.recommendedAction}</p>
                  </div>
                  <ArrowRight size={14} style={{ color: "var(--text-muted)" }} className="shrink-0 mt-2" />
                </Link>
              );
            })}
          </div>
        )}
      </Card>

      {/* Recent actions */}
      {plan.actions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Hành động orchestrator vừa thực hiện</CardTitle>
          </CardHeader>
          <div className="space-y-2">
            {plan.actions.map((a, idx) => {
              const meta = AGENT_META[a.agent];
              const statusColor = a.status === "executed" ? "var(--accent)" : a.status === "queued" ? "var(--amber)" : "var(--text-muted)";
              const statusLabel = a.status === "executed" ? "Đã thực thi" : a.status === "queued" ? "Đề xuất" : "Bỏ qua";
              return (
                <div key={idx} className="flex items-center gap-3 p-2.5 rounded-lg" style={{ background: "var(--bg-subtle)" }}>
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full" style={{ background: statusColor, color: "white" }}>
                    {statusLabel}
                  </span>
                  <p className="text-xs font-medium" style={{ color: "var(--text)" }}>{meta?.label ?? a.agent}</p>
                  <p className="text-[11px] flex-1 truncate" style={{ color: "var(--text-muted)" }}>{a.action}</p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* API Quota status */}
      {quotas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>API Quota (15-30 phút gần nhất)</CardTitle>
            <Lightning size={14} style={{ color: "var(--amber)" }} weight="fill" />
          </CardHeader>
          <div className="space-y-2">
            {quotas.map((q) => {
              const provider = q.key.split(":")[0];
              const scope = q.key.split(":").slice(1).join(":");
              const barColor = q.pct > 80 ? "var(--rose)" : q.pct > 60 ? "var(--amber)" : "var(--accent)";
              return (
                <div key={q.key} className="rounded-lg p-2.5" style={{ background: "var(--bg-subtle)" }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium" style={{ color: "var(--text)" }}>
                      <span className="uppercase font-bold mr-1.5" style={{ color: barColor }}>{provider}</span>
                      <span style={{ color: "var(--text-muted)" }}>{scope}</span>
                    </span>
                    <span className="text-[11px] tabular-nums" style={{ color: "var(--text-secondary)" }}>
                      {q.used} / {q.limit}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-card)" }}>
                    <div className="h-full transition-all" style={{ background: barColor, width: `${Math.min(100, q.pct)}%` }} />
                  </div>
                  <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                    Reset trong {q.windowEndsIn < 60 ? `${q.windowEndsIn}s` : `${Math.round(q.windowEndsIn / 60)} phút`}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Workflows section */}
      <Card>
        <CardHeader>
          <CardTitle>Chained Workflows</CardTitle>
          <TreeStructure size={15} style={{ color: "var(--accent)" }} weight="fill" />
        </CardHeader>

        {/* Manual trigger buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          {(["revenue_drop", "competitor_surge", "engagement_drop"] as const).map((wfName) => {
            const meta = WORKFLOW_META[wfName];
            return (
              <button
                key={wfName}
                onClick={() => triggerWorkflow(wfName)}
                disabled={triggering === wfName}
                className="text-xs px-3 py-1.5 rounded-lg font-medium transition-opacity hover:opacity-80 disabled:opacity-50 flex items-center gap-1.5"
                style={{ background: meta.color + "1A", color: meta.color, border: `1px solid ${meta.color}40` }}
              >
                {triggering === wfName ? <ArrowsClockwise size={11} className="animate-spin" /> : <TreeStructure size={11} weight="fill" />}
                Trigger: {meta.label}
              </button>
            );
          })}
        </div>

        {workflows.length === 0 ? (
          <p className="text-xs text-center py-4" style={{ color: "var(--text-muted)" }}>
            Chưa có workflow nào chạy. Bấm trigger ở trên hoặc đợi Orchestrator tự kích hoạt khi signal critical.
          </p>
        ) : (
          <div className="relative">
            {/* Vertical connector line */}
            <div
              className="absolute left-[15px] top-4 bottom-4 w-px"
              style={{ background: "var(--border)" }}
            />
            <div className="space-y-3">
              {workflows.slice(0, 5).map((wf) => {
                const meta = WORKFLOW_META[wf.name];
                const isExpanded = expandedWf === wf.id;
                const statusColor = wf.status === "completed" ? "var(--accent)" : wf.status === "failed" ? "var(--rose)" : "var(--amber)";
                const statusLabel = wf.status === "completed" ? "Hoàn thành" : wf.status === "failed" ? "Thất bại" : "Đang chạy";
                return (
                  <div key={wf.id} className="flex gap-3">
                    {/* Timeline node */}
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10"
                      style={{ background: statusColor + "22", border: `2px solid ${statusColor}` }}
                    >
                      <TreeStructure size={12} weight="fill" style={{ color: statusColor }} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
                      <button
                        onClick={() => setExpandedWf(isExpanded ? null : wf.id)}
                        className="w-full flex items-center gap-3 p-3 text-left hover:bg-[var(--bg-subtle)] transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs font-semibold" style={{ color: "var(--text)" }}>
                              {meta?.label ?? wf.name}
                            </p>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: statusColor, color: "white" }}>
                              {statusLabel}
                            </span>
                          </div>
                          <p className="text-[10px] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                            {wf.trigger} · {new Date(wf.startedAt).toLocaleString("vi-VN")}
                          </p>
                        </div>
                        <CaretDown size={10} style={{ color: "var(--text-muted)", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease", flexShrink: 0 }} />
                      </button>
                      {isExpanded && wf.plan && (
                        <div className="px-3 pb-3 text-xs leading-relaxed whitespace-pre-wrap"
                          style={{ color: "var(--text-secondary)", borderTop: "1px solid var(--border)" }}>
                          <div className="pt-2 rounded-lg p-2 mt-1" style={{ background: "var(--bg-subtle)" }}>
                            <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--premium)" }}>
                              CEO Plan
                            </p>
                            {wf.plan}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* All signals breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>State hệ thống chi tiết</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs" style={{ color: "var(--text-secondary)" }}>
          <div className="flex justify-between"><span>Revenue 7d:</span><strong style={{ color: "var(--text)" }}>{vnd(s.revenue.last7)}đ</strong></div>
          <div className="flex justify-between"><span>Forecast 7d:</span><strong style={{ color: "var(--text)" }}>{vnd(s.forecast.next7Predicted)}đ</strong></div>
          <div className="flex justify-between"><span>Lead nóng:</span><strong style={{ color: "var(--text)" }}>{s.leads.hotUnclosed}</strong></div>
          <div className="flex justify-between"><span>Lead lạnh nguy cơ mất:</span><strong style={{ color: "var(--text)" }}>{s.leads.coldNoNurture}</strong></div>
          <div className="flex justify-between"><span>Tin nhắn chưa đọc:</span><strong style={{ color: "var(--text)" }}>{s.inbox.unread}</strong></div>
          <div className="flex justify-between"><span>Bình luận tiêu cực:</span><strong style={{ color: "var(--text)" }}>{s.comments.negativeUnreplied}</strong></div>
          <div className="flex justify-between"><span>Yêu cầu duyệt &gt; 24h:</span><strong style={{ color: "var(--text)" }}>{s.approvals.pendingOver24h}</strong></div>
          <div className="flex justify-between"><span>Bài lên lịch mai:</span><strong style={{ color: "var(--text)" }}>{s.posts.scheduledTomorrow}</strong></div>
          <div className="flex justify-between"><span>Đối thủ viral 7d:</span><strong style={{ color: "var(--text)" }}>{s.competitor.surgeCount}</strong></div>
        </div>
      </Card>
    </div>
  );
}
