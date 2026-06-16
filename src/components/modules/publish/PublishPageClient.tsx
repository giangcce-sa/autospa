"use client";

import { useState } from "react";
import { PublishManager } from "./PublishManager";
import { CalendarView } from "./CalendarView";
import { PaperPlaneTilt, CalendarBlank } from "@phosphor-icons/react";

interface Props {
  initialPostId?: string;
  initialImageUrl?: string;
}

const TABS = [
  { id: "publish", label: "Đăng bài", icon: PaperPlaneTilt },
  { id: "calendar", label: "Lịch nội dung", icon: CalendarBlank },
] as const;

type Tab = (typeof TABS)[number]["id"];

export function PublishPageClient({ initialPostId, initialImageUrl }: Props) {
  const [tab, setTab] = useState<Tab>("publish");

  return (
    <div className="space-y-4">
      {/* Tab toggle */}
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

      {tab === "publish" ? (
        <PublishManager initialPostId={initialPostId} initialImageUrl={initialImageUrl} />
      ) : (
        <CalendarView />
      )}
    </div>
  );
}
