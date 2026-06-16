"use client";

import { useState } from "react";
import { CRMManager } from "@/components/modules/crm/CRMManager";
import { CLVDashboard } from "@/components/modules/crm/CLVDashboard";
import { PageHeader } from "@/components/ui/PageHeader";

const TABS = [
  { key: "crm", label: "Khách hàng" },
  { key: "clv", label: "CLV & Churn" },
];

export default function CRMPage() {
  const [tab, setTab] = useState("crm");

  return (
    <>
      <PageHeader title="Mini CRM" description="Quản lý hồ sơ khách hàng, phân khúc, CLV và churn prediction" />

      <div className="flex gap-1 p-1 rounded-lg w-fit mb-4" style={{ background: "var(--bg-subtle)" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="px-4 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{
              background: tab === t.key ? "var(--bg-card)" : "transparent",
              color: tab === t.key ? "var(--text)" : "var(--text-muted)",
              boxShadow: tab === t.key ? "var(--shadow-sm)" : "none",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "crm" ? <CRMManager /> : <CLVDashboard />}
    </>
  );
}
