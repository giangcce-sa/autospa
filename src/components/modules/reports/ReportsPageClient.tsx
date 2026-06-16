"use client";

import { useState } from "react";
import { ReportsDashboard } from "./ReportsDashboard";
import { RevenueAttribution } from "./RevenueAttribution";
import { RevenueForecast } from "./RevenueForecast";
import { AIAnalyst } from "./AIAnalyst";
import { ChartLine, CurrencyCircleDollar, TrendUp, Robot } from "@phosphor-icons/react";

const TABS = [
  { id: "overview", label: "Tổng quan", icon: ChartLine },
  { id: "analyst", label: "AI Analyst", icon: Robot },
  { id: "attribution", label: "Theo nguồn", icon: CurrencyCircleDollar },
  { id: "forecast", label: "Dự báo", icon: TrendUp },
] as const;

type Tab = (typeof TABS)[number]["id"];

export function ReportsPageClient() {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div className="space-y-4">
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: "var(--bg-subtle)" }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={
              tab === id
                ? { background: "var(--accent)", color: "white" }
                : { background: "transparent", color: "var(--text-secondary)" }
            }
          >
            <Icon size={13} weight={tab === id ? "fill" : "regular"} />
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && <ReportsDashboard />}
      {tab === "analyst" && <AIAnalyst />}
      {tab === "attribution" && <RevenueAttribution />}
      {tab === "forecast" && <RevenueForecast />}
    </div>
  );
}
