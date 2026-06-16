"use client";

import { useState } from "react";
import { CompetitorView } from "./CompetitorView";
import { IntelligenceDashboard } from "./IntelligenceDashboard";
import { Eye, FacebookLogo } from "@phosphor-icons/react";

const TABS = [
  { id: "intelligence", label: "Intelligence Insight", icon: Eye },
  { id: "competitors", label: "FB Page đối thủ", icon: FacebookLogo },
] as const;

type Tab = (typeof TABS)[number]["id"];

export function CompetitorsPageClient() {
  const [tab, setTab] = useState<Tab>("intelligence");

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

      {tab === "intelligence" ? <IntelligenceDashboard /> : <CompetitorView />}
    </div>
  );
}
