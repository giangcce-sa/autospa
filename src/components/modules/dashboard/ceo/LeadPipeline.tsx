"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";

interface Stage {
  label: string;
  count: number;
  color: string;
  pct: number;
}

export function LeadPipeline() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetch("/api/sale")
      .then((r) => r.json())
      .then((res) => {
        const leads = res.data ?? [];
        const counts: Record<string, number> = {
          new: 0, contacted: 0, interested: 0, booked: 0, closed: 0,
        };
        leads.forEach((l: { status: string }) => {
          if (l.status in counts) counts[l.status]++;
          else counts.new++;
        });
        const t = leads.length || 1;
        setTotal(leads.length);
        setStages([
          { label: "Lead mới", count: counts.new, color: "var(--blue)", pct: Math.round((counts.new / t) * 100) },
          { label: "Đã liên hệ", count: counts.contacted, color: "var(--accent)", pct: Math.round((counts.contacted / t) * 100) },
          { label: "Có nhu cầu", count: counts.interested, color: "var(--amber)", pct: Math.round((counts.interested / t) * 100) },
          { label: "Đã đặt lịch", count: counts.booked, color: "var(--premium)", pct: Math.round((counts.booked / t) * 100) },
          { label: "Chốt được", count: counts.closed, color: "var(--success)", pct: Math.round((counts.closed / t) * 100) },
        ]);
      })
      .catch(() => setStages([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="space-y-2">{[85, 70, 55, 40, 25].map((w, i) => (
      <div key={i} className="skeleton rounded-lg" style={{ height: 32, width: `${w}%`, margin: "0 auto" }} />
    ))}</div>;
  }

  const maxCount = Math.max(...stages.map((s) => s.count), 1);

  return (
    <div className="space-y-1.5">
      {stages.map((stage, i) => {
        const widthPct = 100 - i * 10;
        const barWidthPct = (stage.count / maxCount) * 100;
        const convRate = i > 0 && stages[i - 1].count > 0
          ? Math.round((stage.count / stages[i - 1].count) * 100)
          : null;
        return (
          <div key={stage.label} style={{ width: `${widthPct}%`, margin: "0 auto" }}>
            <div
              className="relative flex items-center justify-between px-3 py-2.5 rounded-xl overflow-hidden transition-all hover:scale-[1.02]"
              style={{
                background: `linear-gradient(135deg, ${stage.color}22 0%, ${stage.color}10 100%)`,
                border: `1px solid ${stage.color}44`,
              }}
            >
              {/* animated fill bar */}
              <div
                className="absolute left-0 top-0 h-full"
                style={{
                  width: `${barWidthPct}%`,
                  background: `linear-gradient(90deg, ${stage.color}28, ${stage.color}08)`,
                  transition: "width 1s cubic-bezier(0.4,0,0.2,1)",
                }}
              />
              <div className="relative flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: stage.color }} />
                <span className="text-xs font-medium" style={{ color: "var(--text)" }}>{stage.label}</span>
              </div>
              <div className="relative flex items-center gap-2">
                <span className="text-sm font-bold tabular-nums" style={{ color: stage.color }}>{stage.count}</span>
                {convRate !== null && (
                  <span className="text-[9px] px-1 py-0.5 rounded-full font-semibold" style={{ background: stage.color + "20", color: stage.color }}>
                    {convRate}%
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
      <Link
        href="/sale"
        className="flex items-center justify-center gap-1 pt-1 text-[10px] transition-opacity hover:opacity-70"
        style={{ color: "var(--text-muted)" }}
      >
        Tổng {total} lead · Xem chi tiết <ArrowRight size={9} />
      </Link>
    </div>
  );
}
