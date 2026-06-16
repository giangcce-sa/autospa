"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, PaperPlaneTilt, Clock, PencilSimple, Image } from "@phosphor-icons/react";

interface DaySlot {
  label: string;
  date: string;
  published: number;
  scheduled: number;
  draft: number;
  isToday: boolean;
}

export function ContentFactory() {
  const [days, setDays] = useState<DaySlot[]>([]);
  const [totals, setTotals] = useState({ total: 0, draft: 0, scheduled: 0, published: 0, image: 0, pending: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/content/list")
      .then((r) => r.json())
      .then((res) => {
        const posts: { scheduledAt: string | null; status: string; platform: string }[] = res.data ?? [];
        const today = new Date();

        // Build 7-day window: 3 days ago → today → 3 days ahead
        const slots: DaySlot[] = [];
        for (let d = -3; d <= 3; d++) {
          const dt = new Date(today);
          dt.setDate(today.getDate() + d);
          const dateStr = dt.toISOString().slice(0, 10);
          const DAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

          const dayPosts = posts.filter((p) => p.scheduledAt && p.scheduledAt.slice(0, 10) === dateStr);
          slots.push({
            label: DAY_LABELS[dt.getDay()],
            date: dt.getDate() + "/" + (dt.getMonth() + 1),
            published: dayPosts.filter((p) => p.status === "published").length,
            scheduled: dayPosts.filter((p) => p.status === "scheduled").length,
            draft: dayPosts.filter((p) => p.status === "draft").length,
            isToday: d === 0,
          });
        }
        setDays(slots);

        // Totals
        setTotals({
          total: posts.length,
          draft: posts.filter((p) => p.status === "draft").length,
          scheduled: posts.filter((p) => p.status === "scheduled").length,
          published: posts.filter((p) => p.status === "published").length,
          image: posts.filter((p) => p.platform === "instagram").length,
          pending: posts.filter((p) => p.status === "pending_review").length,
        });
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="space-y-3">
      <div className="skeleton h-24 rounded-xl" />
      <div className="grid grid-cols-6 gap-1">{[1,2,3,4,5,6].map(i => <div key={i} className="skeleton h-6 rounded" />)}</div>
    </div>;
  }

  const maxBar = Math.max(...days.map((d) => d.published + d.scheduled + d.draft), 1);

  return (
    <div className="space-y-3">
      {/* Totals row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Tổng bài", value: totals.total, icon: PencilSimple, color: "var(--text-secondary)" },
          { label: "Đã đăng", value: totals.published, icon: PaperPlaneTilt, color: "var(--success)" },
          { label: "Lên lịch", value: totals.scheduled, icon: Clock, color: "var(--warning)" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-lg px-2 py-1.5 text-center" style={{ background: "var(--bg-subtle)" }}>
              <Icon size={11} weight="fill" style={{ color: s.color, margin: "0 auto 2px" }} />
              <p className="text-base font-bold tabular-nums" style={{ color: "var(--text)" }}>{s.value}</p>
              <p className="text-[9px]" style={{ color: "var(--text-muted)" }}>{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* 7-day bar chart */}
      <div className="grid grid-cols-7 gap-1 items-end" style={{ height: 64 }}>
        {days.map((day) => {
          const total = day.published + day.scheduled + day.draft;
          const barH = total === 0 ? 4 : Math.max(12, Math.round((total / maxBar) * 56));
          return (
            <div key={day.date} className="flex flex-col items-center gap-0.5">
              {/* Bar */}
              <div className="w-full flex flex-col justify-end rounded-t overflow-hidden" style={{ height: 48 }}>
                {total > 0 ? (
                  <div style={{ height: barH }}>
                    {day.published > 0 && (
                      <div style={{ height: `${(day.published / total) * 100}%`, background: "var(--success)", minHeight: 3 }} />
                    )}
                    {day.scheduled > 0 && (
                      <div style={{ height: `${(day.scheduled / total) * 100}%`, background: "var(--warning)", minHeight: 3 }} />
                    )}
                    {day.draft > 0 && (
                      <div style={{ height: `${(day.draft / total) * 100}%`, background: "var(--border-strong)", minHeight: 3 }} />
                    )}
                  </div>
                ) : (
                  <div className="w-full rounded-t" style={{ height: 4, background: "var(--border)" }} />
                )}
              </div>
              {/* Label */}
              <p
                className="text-[9px] font-medium"
                style={{
                  color: day.isToday ? "var(--accent)" : "var(--text-muted)",
                  fontWeight: day.isToday ? 700 : 400,
                }}
              >
                {day.label}
              </p>
              {day.isToday && <div className="w-1 h-1 rounded-full" style={{ background: "var(--accent)" }} />}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 text-[9px]" style={{ color: "var(--text-muted)" }}>
        {[["var(--success)", "Đã đăng"], ["var(--warning)", "Lên lịch"], ["var(--border-strong)", "Nháp"]].map(([c, l]) => (
          <span key={l} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm" style={{ background: c }} />{l}
          </span>
        ))}
        <Link href="/publish" className="ml-auto flex items-center gap-0.5 hover:opacity-70">
          Xem lịch <ArrowRight size={8} />
        </Link>
      </div>
    </div>
  );
}
