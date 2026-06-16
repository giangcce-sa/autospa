"use client";

import { useState, useEffect, useCallback } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import Link from "next/link";

interface CalendarPost {
  id: string;
  caption: string;
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
}

const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const MONTHS = [
  "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
  "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12",
];

function getDateKey(post: CalendarPost): string | null {
  return post.scheduledAt ?? post.publishedAt ?? null;
}

export function CalendarView() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [posts, setPosts] = useState<CalendarPost[]>([]);

  const loadPosts = useCallback(async () => {
    const [r1, r2] = await Promise.all([
      fetch("/api/content/list?status=scheduled").then((r) => r.json()),
      fetch("/api/content/list?status=published").then((r) => r.json()),
    ]);
    setPosts([...(r1.data ?? []), ...(r2.data ?? [])]);
  }, []);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  // Group posts by day number within this month
  const postsByDay: Record<number, CalendarPost[]> = {};
  for (const post of posts) {
    const raw = getDateKey(post);
    if (!raw) continue;
    const d = new Date(raw);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!postsByDay[day]) postsByDay[day] = [];
      postsByDay[day].push(post);
    }
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border)" }}
      >
        <button
          onClick={prevMonth}
          className="p-1.5 rounded-lg hover:opacity-70"
          style={{ background: "var(--bg-subtle)" }}
        >
          <CaretLeft size={14} style={{ color: "var(--text-secondary)" }} />
        </button>
        <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>
          {MONTHS[month]} {year}
        </p>
        <button
          onClick={nextMonth}
          className="p-1.5 rounded-lg hover:opacity-70"
          style={{ background: "var(--bg-subtle)" }}
        >
          <CaretRight size={14} style={{ color: "var(--text-secondary)" }} />
        </button>
      </div>

      {/* Weekday row */}
      <div className="grid grid-cols-7" style={{ background: "var(--bg-subtle)", borderBottom: "1px solid var(--border)" }}>
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2 text-center text-[10px] font-semibold tracking-wide" style={{ color: "var(--text-muted)" }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7" style={{ background: "var(--bg-card)" }}>
        {cells.map((day, idx) => {
          const isToday =
            day !== null &&
            year === today.getFullYear() &&
            month === today.getMonth() &&
            day === today.getDate();
          const dayPosts = day ? (postsByDay[day] ?? []) : [];

          return (
            <div
              key={idx}
              className="min-h-[80px] p-1.5 border-r border-b last:border-r-0"
              style={{
                borderColor: "var(--border)",
                background: day ? "var(--bg-card)" : "var(--bg-subtle)",
              }}
            >
              {day && (
                <>
                  <span
                    className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-medium mb-1"
                    style={{
                      background: isToday ? "var(--accent)" : "transparent",
                      color: isToday ? "white" : "var(--text-muted)",
                    }}
                  >
                    {day}
                  </span>
                  <div className="space-y-0.5">
                    {dayPosts.slice(0, 3).map((post) => (
                      <Link
                        key={post.id}
                        href={`/publish?postId=${post.id}`}
                        className="block text-[9px] leading-tight px-1 py-0.5 rounded truncate hover:opacity-80 transition-opacity"
                        style={
                          post.status === "published"
                            ? { background: "rgba(45,106,79,0.12)", color: "var(--accent)" }
                            : { background: "rgba(217,119,6,0.12)", color: "var(--amber)" }
                        }
                        title={post.caption}
                      >
                        {post.caption.slice(0, 28)}
                      </Link>
                    ))}
                    {dayPosts.length > 3 && (
                      <p className="text-[9px] pl-1" style={{ color: "var(--text-muted)" }}>
                        +{dayPosts.length - 3} bài
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div
        className="flex items-center gap-4 px-5 py-2"
        style={{ background: "var(--bg-subtle)", borderTop: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: "var(--amber)" }} />
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Lên lịch</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: "var(--accent)" }} />
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Đã đăng</span>
        </div>
      </div>
    </div>
  );
}
