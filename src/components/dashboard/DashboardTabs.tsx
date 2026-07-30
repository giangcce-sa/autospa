"use client";

import { Children, cloneElement, isValidElement, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface DashboardTabItem {
  id: string;
  label: string;
}

export function DashboardTabs({
  items,
  children,
  className,
}: {
  items: DashboardTabItem[];
  children: React.ReactNode;
  className?: string;
}) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");
  const baseId = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function activate(index: number) {
    const item = items[(index + items.length) % items.length];
    if (!item) return;
    setActiveId(item.id);
    refs.current[(index + items.length) % items.length]?.focus();
  }

  return (
    <div className={cn("dashboard-tabs", className)}>
      <div className="mb-4 flex gap-1 overflow-x-auto rounded-[10px] border border-[var(--border)] bg-[var(--bg-subtle)] p-1 lg:hidden" role="tablist" aria-label="Nhóm dữ liệu dashboard">
        {items.map((item, index) => (
          <button
            key={item.id}
            ref={(node) => { refs.current[index] = node; }}
            id={`${baseId}-tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={activeId === item.id}
            aria-controls={`${baseId}-panel-${item.id}`}
            tabIndex={activeId === item.id ? 0 : -1}
            onClick={() => setActiveId(item.id)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") { event.preventDefault(); activate(index + 1); }
              if (event.key === "ArrowLeft") { event.preventDefault(); activate(index - 1); }
              if (event.key === "Home") { event.preventDefault(); activate(0); }
              if (event.key === "End") { event.preventDefault(); activate(items.length - 1); }
            }}
            className={cn("min-h-11 flex-1 shrink-0 rounded-[7px] px-3 text-xs font-bold", activeId === item.id ? "bg-[var(--bg-card)] text-[var(--accent)] shadow-sm" : "text-[var(--text-muted)]")}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="space-y-5">
        {Children.map(children, (child) => {
          if (!isValidElement<DashboardTabPanelProps>(child)) return child;
          return cloneElement(child, { active: activeId === child.props.id, baseId });
        })}
      </div>
    </div>
  );
}

interface DashboardTabPanelProps {
  id: string;
  children: React.ReactNode;
  className?: string;
  active?: boolean;
  baseId?: string;
}

export function DashboardTabPanel({ id, children, className, active = false, baseId = "dashboard" }: DashboardTabPanelProps) {
  return (
    <div
      id={`${baseId}-panel-${id}`}
      role="tabpanel"
      aria-labelledby={`${baseId}-tab-${id}`}
      className={cn("space-y-5", active ? "block" : "hidden lg:block", className)}
    >
      {children}
    </div>
  );
}
