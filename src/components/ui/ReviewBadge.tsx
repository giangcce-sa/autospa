"use client";

import { useState } from "react";
import { CheckCircle, Warning, XCircle, CaretDown, ShieldCheck } from "@phosphor-icons/react";

export interface ReviewIssue {
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  suggestion?: string;
}

interface Review {
  status: "pass" | "warn" | "fail";
  score: number;
  issues: ReviewIssue[];
}

const STATUS_META = {
  pass: { color: "var(--accent)", bg: "var(--accent-light)", icon: CheckCircle, label: "Pass" },
  warn: { color: "var(--amber)", bg: "var(--amber-light)", icon: Warning, label: "Cảnh báo" },
  fail: { color: "var(--rose)", bg: "var(--rose-light)", icon: XCircle, label: "Block" },
} as const;

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

export function ReviewBadge({ review }: { review: Review | null | undefined }) {
  const [expanded, setExpanded] = useState(false);
  if (!review) return null;

  const meta = STATUS_META[review.status];
  const Icon = meta.icon;
  const sorted = [...review.issues].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: meta.bg, border: `1px solid ${meta.color}40` }}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 transition-opacity hover:opacity-80"
      >
        <Icon size={14} weight="fill" style={{ color: meta.color }} />
        <span className="text-xs font-semibold" style={{ color: meta.color }}>
          Reviewer: {meta.label}
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: meta.color, color: "white" }}>
          {review.score}/100
        </span>
        {review.issues.length > 0 && (
          <span className="text-[10px]" style={{ color: meta.color }}>
            ({review.issues.length} vấn đề)
          </span>
        )}
        <ShieldCheck size={11} className="ml-auto" style={{ color: meta.color }} />
        {review.issues.length > 0 && (
          <CaretDown
            size={10}
            style={{ color: meta.color, transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}
          />
        )}
      </button>

      {expanded && sorted.length > 0 && (
        <div className="px-3 pb-3 space-y-1.5">
          {sorted.map((issue, idx) => {
            const sevColor =
              issue.severity === "critical" ? "var(--rose)" :
              issue.severity === "high" ? "var(--rose)" :
              issue.severity === "medium" ? "var(--amber)" : "var(--text-muted)";
            return (
              <div
                key={idx}
                className="rounded-lg p-2 text-xs"
                style={{ background: "var(--bg-card)", borderLeft: `2px solid ${sevColor}` }}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full"
                    style={{ background: sevColor + "22", color: sevColor }}>
                    {issue.severity}
                  </span>
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{issue.type}</span>
                </div>
                <p style={{ color: "var(--text)" }}>{issue.message}</p>
                {issue.suggestion && (
                  <p className="mt-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                    → {issue.suggestion}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
