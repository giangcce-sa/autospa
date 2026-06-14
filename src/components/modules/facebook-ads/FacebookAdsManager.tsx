"use client";

import { useState } from "react";
import { CampaignList } from "./CampaignList";
import { CreateAd } from "./CreateAd";
import { AdsInsights } from "./AdsInsights";
import { useActivePage } from "@/contexts/ActivePageContext";
import { ListBullets, Megaphone, ChartBar } from "@phosphor-icons/react";

type Tab = "campaigns" | "create" | "insights";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "campaigns", label: "Chiến dịch", icon: <ListBullets size={14} /> },
  { id: "create", label: "Tạo quảng cáo", icon: <Megaphone size={14} weight="fill" /> },
  { id: "insights", label: "Insights", icon: <ChartBar size={14} /> },
];

interface Props { initialPostId?: string; }

export function FacebookAdsManager({ initialPostId }: Props) {
  const { selectedPageId, selectedPage } = useActivePage();
  const [tab, setTab] = useState<Tab>(initialPostId ? "create" : "campaigns");

  const fbPageId = selectedPageId || undefined;

  return (
    <div className="space-y-4">
      {/* Header + tabs */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--bg-subtle)" }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: tab === t.id ? "var(--bg-card)" : "transparent",
                color: tab === t.id ? "var(--text)" : "var(--text-muted)",
                boxShadow: tab === t.id ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        {selectedPage && (
          <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}>
            {selectedPage.pageName}
          </span>
        )}
      </div>

      {!selectedPage?.adAccountId && (
        <div className="text-xs p-3 rounded-lg" style={{ background: "var(--amber-light)", color: "var(--amber)" }}>
          <strong>Chưa cấu hình Ad Account ID.</strong> Vào <strong>Cài đặt → Facebook Pages</strong> để thêm Ad Account ID cho page này.
        </div>
      )}

      {tab === "campaigns" && <CampaignList facebookPageId={fbPageId} />}
      {tab === "create" && <CreateAd facebookPageId={fbPageId} initialPostId={initialPostId} />}
      {tab === "insights" && <AdsInsights facebookPageId={fbPageId} />}
    </div>
  );
}
