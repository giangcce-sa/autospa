"use client";

import { useState } from "react";
import { InboxView } from "./InboxView";
import { MessageRules } from "./MessageRules";
import { ChatCircleDots, Lightning } from "@phosphor-icons/react";

const TABS = [
  { id: "inbox", label: "Tin nhắn", icon: ChatCircleDots },
  { id: "rules", label: "Quy tắc tự trả lời", icon: Lightning },
] as const;

type Tab = (typeof TABS)[number]["id"];

export function InboxPageClient() {
  const [tab, setTab] = useState<Tab>("inbox");

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

      {tab === "inbox" ? <InboxView /> : <MessageRules />}
    </div>
  );
}
