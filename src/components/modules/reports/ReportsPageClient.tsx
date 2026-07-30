"use client";

import { useId, useRef, useState } from "react";
import { ChartLine, CurrencyCircleDollar, Robot, TrendUp } from "@phosphor-icons/react";
import { HorizontalScroller } from "@/components/ui/HorizontalScroller";
import { PermissionState } from "@/components/ui/EmptyState";
import { AIAnalyst } from "./AIAnalyst";
import { ReportsDashboard } from "./ReportsDashboard";
import { RevenueAttribution } from "./RevenueAttribution";
import { RevenueForecast } from "./RevenueForecast";

const TABS = [
  { id: "overview", label: "Tổng quan", icon: ChartLine },
  { id: "analyst", label: "AI Analyst", icon: Robot },
  { id: "attribution", label: "Theo nguồn", icon: CurrencyCircleDollar },
  { id: "forecast", label: "Dự báo", icon: TrendUp },
] as const;

type Tab = (typeof TABS)[number]["id"];

function AccountReportPermission() {
  return <PermissionState density="panel" title="Báo cáo này chỉ dành cho Owner" description="Attribution và dự báo sử dụng dữ liệu cấp tài khoản." />;
}

export function ReportsPageClient({ canMutate = true }: { canMutate?: boolean }) {
  const [tab, setTab] = useState<Tab>("overview");
  const baseId = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const activate = (index: number) => {
    const next = TABS[(index + TABS.length) % TABS.length];
    setTab(next.id);
    refs.current[(index + TABS.length) % TABS.length]?.focus();
  };

  return (
    <div className="space-y-5">
      <HorizontalScroller className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-subtle)]" contentClassName="flex gap-1 p-1" label="Nhóm báo cáo">
        <div className="contents" role="tablist" aria-label="Nhóm báo cáo">
          {TABS.map(({ id, label, icon: Icon }, index) => (
            <button
              key={id}
              ref={(node) => { refs.current[index] = node; }}
              id={`${baseId}-tab-${id}`}
              type="button"
              role="tab"
              aria-selected={tab === id}
              aria-controls={`${baseId}-panel-${id}`}
              tabIndex={tab === id ? 0 : -1}
              onClick={() => setTab(id)}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight") { event.preventDefault(); activate(index + 1); }
                if (event.key === "ArrowLeft") { event.preventDefault(); activate(index - 1); }
                if (event.key === "Home") { event.preventDefault(); activate(0); }
                if (event.key === "End") { event.preventDefault(); activate(TABS.length - 1); }
              }}
              className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-[var(--radius-md)] px-4 text-xs font-bold transition-colors ${tab === id ? "bg-[var(--bg-card)] text-[var(--accent)] shadow-sm" : "text-[var(--text-secondary)] hover:bg-[var(--action-quiet-hover)]"}`}
            >
              <Icon size={14} weight={tab === id ? "fill" : "regular"} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </HorizontalScroller>

      <div id={`${baseId}-panel-${tab}`} role="tabpanel" aria-labelledby={`${baseId}-tab-${tab}`}>
        {tab === "overview" ? <ReportsDashboard /> : null}
        {tab === "analyst" ? <AIAnalyst canMutate={canMutate} /> : null}
        {tab === "attribution" ? (canMutate ? <RevenueAttribution /> : <AccountReportPermission />) : null}
        {tab === "forecast" ? (canMutate ? <RevenueForecast /> : <AccountReportPermission />) : null}
      </div>
    </div>
  );
}
