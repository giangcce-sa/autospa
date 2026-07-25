"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getCanonicalRouteHref } from "@/config/routes";
import {
  Sun, ArrowRight, X, ArrowsClockwise, ChatsTeardrop, CaretDown,
  Eye, Megaphone, PencilSimple, Flame, CheckCircle,
} from "@phosphor-icons/react";

interface DebateTurn {
  speaker: string;
  provider: "claude" | "openai" | string;
  content: string;
}

interface SubReport {
  summary: string;
  trends?: string[];
  competitorAlerts?: string[];
  performance?: string[];
  alerts?: string[];
  topPerformers?: string[];
  underperformers?: string[];
  funnelStats?: string[];
  hotLeads?: string[];
  recommendations: string[];
}

interface SubReports {
  intelligence: SubReport;
  ads: SubReport;
  content: SubReport;
  sales: SubReport;
}

interface Assignment {
  agent: string;
  task: string;
  priority: "high" | "medium" | "low";
}

interface Brief {
  id: string;
  date: string;
  summary: string;
  actions: string;            // legacy JSON for backward compat
  debate?: string | null;
  subReports?: string | null;
  assignments?: string | null;
  dismissed: boolean;
}

const AGENT_META: Record<string, { label: string; icon: React.ElementType; color: string; href: string }> = {
  intelligence: { label: "Đối thủ", icon: Eye, color: "var(--amber)", href: "/competitors" },
  ads: { label: "Quảng cáo", icon: Megaphone, color: "var(--blue)", href: "/facebook-ads" },
  content: { label: "Nội dung", icon: PencilSimple, color: "var(--accent)", href: "/content-research" },
  sales: { label: "Bán hàng", icon: Flame, color: "var(--rose)", href: "/sale" },
};

const PRIORITY_COLOR: Record<string, string> = {
  high: "var(--rose)",
  medium: "var(--amber)",
  low: "var(--accent)",
};

const PRIORITY_LABEL: Record<string, string> = {
  high: "Cao",
  medium: "Vừa",
  low: "Thấp",
};

function softTone(color: string) {
  const tones: Record<string, string> = {
    "var(--amber)": "var(--amber-light)",
    "var(--blue)": "var(--blue-light)",
    "var(--accent)": "var(--accent-light)",
    "var(--rose)": "var(--rose-light)",
  };
  return tones[color] ?? `color-mix(in srgb, ${color} 14%, transparent)`;
}

export function MorningBriefCard() {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [showDebate, setShowDebate] = useState(false);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/morning-brief")
      .then((r) => r.json())
      .then((res) => { if (res.success) setBrief(res.data); })
      .finally(() => setLoading(false));
  }, []);

  const dismiss = async () => {
    if (!brief) return;
    await fetch("/api/morning-brief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "dismiss", id: brief.id }),
    });
    setBrief({ ...brief, dismissed: true });
  };

  const regenerate = async () => {
    setRegenerating(true);
    try {
      const res = await fetch("/api/morning-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "regenerate" }),
      });
      const data = await res.json();
      if (data.success) setBrief(data.data);
    } finally { setRegenerating(false); }
  };

  if (loading || !brief || brief.dismissed) return null;

  let debateTurns: DebateTurn[] = [];
  let subReports: SubReports | null = null;
  let assignments: Assignment[] = [];

  try {
    if (brief.debate) debateTurns = JSON.parse(brief.debate);
    if (brief.subReports) subReports = JSON.parse(brief.subReports);
    if (brief.assignments) assignments = JSON.parse(brief.assignments);
  } catch { /* ignore */ }

  if (!brief.summary && !subReports && assignments.length === 0) return null;

  return (
    <div className="space-y-3">
      <div
        className="rounded-lg p-5 border"
        style={{
          background: "var(--bg-card)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md flex items-center justify-center" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
              <Sun size={19} weight="fill" />
            </div>
            <div>
              <p className="text-[12px] font-semibold" style={{ color: "var(--text-muted)" }}>
                AI standup hằng ngày
              </p>
              <p className="text-[17px] font-bold leading-tight" style={{ color: "var(--text)" }}>
                4 sub-agent đã báo cáo kế hoạch hôm nay
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={regenerate} disabled={regenerating}
              className="p-2 rounded-md transition-colors hover:bg-[var(--bg-subtle)]"
              style={{ color: "var(--text-secondary)" }} title="Chạy lại standup">
              <ArrowsClockwise size={13} className={regenerating ? "animate-spin" : ""} />
            </button>
            <button onClick={dismiss}
              className="p-2 rounded-md transition-colors hover:bg-[var(--bg-subtle)]"
              style={{ color: "var(--text-secondary)" }} title="Đóng">
              <X size={13} />
            </button>
          </div>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{brief.summary}</p>
      </div>

      {/* 4 sub-reports grid */}
      {subReports && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(["intelligence", "ads", "content", "sales"] as const).map((key) => {
            const r = subReports[key];
            const meta = AGENT_META[key];
            const Icon = meta.icon;
            const isExpanded = expandedReport === key;

            // Pick the first array that has items for "highlights"
            const bullets = r.trends ?? r.performance ?? r.topPerformers ?? r.funnelStats ?? [];
            const alerts = r.competitorAlerts ?? r.alerts ?? r.underperformers ?? r.hotLeads ?? [];

            return (
              <div
                key={key}
                className="rounded-lg p-4 transition-all"
                style={{
                  background: "var(--bg-card)",
                  border: `1px solid ${isExpanded ? meta.color : "var(--border)"}`,
                }}
              >
                <button
                  onClick={() => setExpandedReport(isExpanded ? null : key)}
                  className="w-full flex items-start gap-3"
                >
                  <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                    style={{ background: softTone(meta.color) }}>
                    <Icon size={13} weight="fill" style={{ color: meta.color }} />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-[11px] font-bold" style={{ color: meta.color }}>
                      {meta.label}
                    </p>
                    <p className="text-xs leading-snug mt-0.5" style={{ color: "var(--text)" }}>{r.summary}</p>
                  </div>
                  <CaretDown size={11} style={{ color: "var(--text-muted)", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }} />
                </button>

                {isExpanded && (
                  <div className="mt-3 space-y-2 text-[12px]">
                    {bullets.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold mb-1" style={{ color: "var(--text-muted)" }}>Điểm chính</p>
                        <ul className="space-y-1">
                          {bullets.map((b, i) => (
                            <li key={i} className="flex items-start gap-1.5" style={{ color: "var(--text-secondary)" }}>
                              <span style={{ color: meta.color }}>●</span>{b}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {alerts.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold mb-1" style={{ color: "var(--amber)" }}>Cần chú ý</p>
                        <ul className="space-y-1">
                          {alerts.map((a, i) => (
                            <li key={i} className="flex items-start gap-1.5" style={{ color: "var(--text-secondary)" }}>
                              <span style={{ color: "var(--amber)" }}>!</span>{a}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {r.recommendations.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold mb-1" style={{ color: "var(--accent)" }}>Đề xuất</p>
                        <ul className="space-y-1">
                          {r.recommendations.map((rec, i) => (
                            <li key={i} className="flex items-start gap-1.5" style={{ color: "var(--text-secondary)" }}>
                              <span style={{ color: "var(--accent)" }}>→</span>{rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Assignments */}
      {assignments.length > 0 && (
        <div className="rounded-lg p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={14} weight="fill" style={{ color: "var(--accent)" }} />
            <p className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
              CEO giao việc ({assignments.length})
            </p>
          </div>
          <div className="space-y-2">
            {assignments.map((a, idx) => {
              const meta = AGENT_META[a.agent];
              const Icon = meta?.icon ?? CheckCircle;
              const href = meta?.href ?? getCanonicalRouteHref("orchestrator");
              return (
                <Link
                  key={idx}
                  href={href}
                  className="group flex items-center gap-3 p-2.5 rounded-md transition-colors hover:bg-[var(--bg-elevated)]"
                  style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
                >
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                    style={{ background: softTone(PRIORITY_COLOR[a.priority]), color: PRIORITY_COLOR[a.priority] }}
                  >
                    <Icon size={12} weight="fill" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-[10px] font-bold" style={{ color: meta?.color ?? "var(--text-muted)" }}>
                        {meta?.label ?? a.agent}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold"
                        style={{ background: PRIORITY_COLOR[a.priority], color: "white" }}>
                        {PRIORITY_LABEL[a.priority] ?? a.priority}
                      </span>
                    </div>
                    <p className="text-sm leading-tight" style={{ color: "var(--text)" }}>{a.task}</p>
                  </div>
                  <ArrowRight size={14} style={{ color: "var(--text-muted)" }} className="shrink-0 transition-transform group-hover:translate-x-1" />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {debateTurns.length > 0 && (
        <div className="rounded-lg px-4 py-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <button
            onClick={() => setShowDebate((v) => !v)}
            className="flex items-center gap-1.5 text-[11px] font-medium transition-opacity hover:opacity-80"
            style={{ color: "var(--text-secondary)" }}
          >
            <ChatsTeardrop size={12} weight="fill" />
            {showDebate ? "Ẩn cuộc tranh luận CEO Council" : `Xem ${debateTurns.length} lượt tranh luận Claude & GPT`}
            <CaretDown size={10} style={{ transform: showDebate ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }} />
          </button>
          {showDebate && (
            <div className="mt-3 space-y-2">
              {debateTurns.map((t, i) => (
                <div
                  key={i}
                  className="rounded-md p-2.5 text-xs"
                  style={{
                    background: "var(--bg-subtle)",
                    borderLeft: `2px solid ${t.provider === "claude" ? "var(--accent)" : "var(--blue)"}`,
                  }}
                >
                  <p className="text-[10px] font-bold mb-1"
                    style={{ color: t.provider === "claude" ? "var(--accent)" : "var(--blue)" }}>
                    {t.speaker}
                  </p>
                  <p className="leading-snug" style={{ color: "var(--text-secondary)" }}>{t.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
