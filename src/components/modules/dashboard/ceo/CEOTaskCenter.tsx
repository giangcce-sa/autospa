"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Circle, CheckCircle } from "@phosphor-icons/react";

interface Task {
  id: string;
  label: string;
  detail?: string;
  href: string;
  priority: "high" | "medium" | "low";
}

const PRIORITY_COLOR = {
  high: "var(--danger)",
  medium: "var(--warning)",
  low: "var(--accent)",
};
const PRIORITY_BG = {
  high: "var(--danger-light)",
  medium: "var(--warning-light)",
  low: "var(--accent-light)",
};
const PRIORITY_LABEL = {
  high: "Khẩn",
  medium: "Quan trọng",
  low: "Bình thường",
};

export function CEOTaskCenter() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/command-center")
      .then((r) => r.json())
      .then((res) => {
        const queue: Array<{ id: string; title: string; detail: string; href: string; priority: "critical" | "high" | "medium" | "low" }> = res.data?.todayQueue ?? [];
        const list: Task[] = queue.slice(0, 5).map((item) => ({
          id: item.id,
          label: item.title,
          detail: item.detail,
          href: item.href,
          priority: item.priority === "critical" ? "high" : item.priority,
        }));

        if (list.length === 0) {
          list.push(
            { id: "fallback:publish", label: "Duyệt lịch nội dung hôm nay", href: "/publish", priority: "low" },
            { id: "fallback:competitors", label: "Xem tín hiệu đối thủ mới", href: "/competitors", priority: "low" },
            { id: "fallback:ads", label: "Kiểm tra hiệu suất quảng cáo", href: "/facebook-ads", priority: "medium" },
          );
        }

        list.push({ id: "run:orchestrator", label: "Chạy Orchestrator phân tích hệ thống", href: "/orchestrator", priority: "medium" });
        setTasks(list.slice(0, 6));
    }).catch(() => setTasks([])).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="space-y-2">{[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-9 rounded-lg" />)}</div>;
  }

  return (
    <div className="space-y-1.5">
      {tasks.map((task, i) => {
        const isDone = done.has(i);
        return (
          <div
            key={task.id}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all"
            style={{
              background: isDone ? "var(--bg-subtle)" : PRIORITY_BG[task.priority],
              border: `1px solid ${isDone ? "var(--border)" : PRIORITY_COLOR[task.priority] + "44"}`,
              opacity: isDone ? 0.5 : 1,
            }}
          >
            <button
              onClick={() => setDone((prev) => {
                const n = new Set(prev);
                if (n.has(i)) n.delete(i);
                else n.add(i);
                return n;
              })}
              className="shrink-0 transition-transform hover:scale-110"
            >
              {isDone
                ? <CheckCircle size={14} weight="fill" style={{ color: "var(--success)" }} />
                : <Circle size={14} style={{ color: PRIORITY_COLOR[task.priority] }} />
              }
            </button>
            <Link href={task.href} className="flex-1 min-w-0 group">
              <p className={`text-xs ${isDone ? "line-through" : ""} truncate`} style={{ color: isDone ? "var(--text-muted)" : "var(--text)" }}>
                {task.label}
              </p>
              {task.detail && (
                <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{task.detail}</p>
              )}
            </Link>
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
              style={{ background: PRIORITY_COLOR[task.priority] + "22", color: PRIORITY_COLOR[task.priority] }}
            >
              {PRIORITY_LABEL[task.priority]}
            </span>
          </div>
        );
      })}
      <Link href="/orchestrator" className="flex items-center justify-center gap-1 pt-1 text-[10px] transition-opacity hover:opacity-70" style={{ color: "var(--text-muted)" }}>
        Xem tất cả trong Orchestrator <ArrowRight size={9} />
      </Link>
    </div>
  );
}
