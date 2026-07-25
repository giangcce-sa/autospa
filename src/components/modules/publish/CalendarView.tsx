"use client";

import { useCallback, useEffect, useState } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

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

export function CalendarView({
  facebookPageId,
  canonical = false,
  initialMonth,
}: {
  facebookPageId?: string;
  canonical?: boolean;
  initialMonth?: string;
} = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const today = new Date();
  const parsedMonth = initialMonth?.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  const initialYearValue = parsedMonth ? Number(parsedMonth[1]) : today.getFullYear();
  const initialMonthValue = parsedMonth ? Number(parsedMonth[2]) - 1 : today.getMonth();
  const [legacyYear, setLegacyYear] = useState(initialYearValue);
  const [legacyMonth, setLegacyMonth] = useState(initialMonthValue);
  const year = canonical ? initialYearValue : legacyYear;
  const month = canonical ? initialMonthValue : legacyMonth;
  const [posts, setPosts] = useState<CalendarPost[]>([]);

  const loadPosts = useCallback(async () => {
    const query = (status: string) => {
      const params = new URLSearchParams({ status });
      if (facebookPageId) params.set("facebookPageId", facebookPageId);
      return `/api/content/list?${params.toString()}`;
    };
    const [r1, r2] = await Promise.all([
      fetch(query("scheduled")).then((r) => r.json()),
      fetch(query("published")).then((r) => r.json()),
    ]);
    setPosts([...(r1.data ?? []), ...(r2.data ?? [])]);
  }, [facebookPageId]);

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

  function setCalendarMonth(nextYear: number, nextMonth: number) {
    if (!canonical) {
      setLegacyYear(nextYear);
      setLegacyMonth(nextMonth);
      return;
    }
    const params = new URLSearchParams({ view: "calendar", scope: "current" });
    if (facebookPageId) params.set("pageId", facebookPageId);
    params.set("month", `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}`);
    router.push(`${pathname}?${params.toString()}`);
  }

  function prevMonth() {
    if (month === 0) setCalendarMonth(year - 1, 11);
    else setCalendarMonth(year, month - 1);
  }

  function nextMonth() {
    if (month === 11) setCalendarMonth(year + 1, 0);
    else setCalendarMonth(year, month + 1);
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
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:opacity-70"
          style={{ background: "var(--bg-subtle)" }}
          aria-label="Tháng trước"
        >
          <CaretLeft size={14} style={{ color: "var(--text-secondary)" }} aria-hidden="true" />
        </button>
        <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>
          {MONTHS[month]} {year}
        </p>
        <button
          onClick={nextMonth}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:opacity-70"
          style={{ background: "var(--bg-subtle)" }}
          aria-label="Tháng sau"
        >
          <CaretRight size={14} style={{ color: "var(--text-secondary)" }} aria-hidden="true" />
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
                        href={canonical
                                ? `/creative/publishing?view=composer&scope=current${facebookPageId ? `&pageId=${encodeURIComponent(facebookPageId)}` : ""}&id=${encodeURIComponent(post.id)}`
                                : `/publish?postId=${post.id}`
                              }
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
