"use client";

import Link from "next/link";
import {
  PencilSimple, Tag, ArrowsClockwise, FloppyDisk, Image as ImageIcon,
  ChatsTeardrop, Brain, Robot,
} from "@phosphor-icons/react";

const ACTIONS = [
  { label: "Viết bài AI", href: "/content", icon: PencilSimple, color: "var(--accent)" },
  { label: "Flash Deal", href: "/promotions", icon: Tag, color: "var(--amber)" },
  { label: "Tạo ảnh AI", href: "/images", icon: ImageIcon, color: "var(--blue)" },
  { label: "Orchestrator", href: "/orchestrator", icon: Robot, color: "var(--premium)", premium: true },
  { label: "AI Council", href: "/council", icon: ChatsTeardrop, color: "var(--premium)", premium: true },
  { label: "CEO Memory", href: "/ceo-memory", icon: Brain, color: "var(--premium)", premium: true },
  { label: "Sync now", href: "/competitors", icon: ArrowsClockwise, color: "var(--text-secondary)" },
  { label: "Backup", href: "/settings", icon: FloppyDisk, color: "var(--text-secondary)" },
];

export function QuickActions() {
  return (
    <div className="flex flex-wrap gap-2">
      {ACTIONS.map((a) => {
        const Icon = a.icon;
        return (
          <Link
            key={a.href + a.label}
            href={a.href}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:-translate-y-px"
            style={{
              background: a.premium ? "var(--premium-light)" : "var(--bg-card)",
              border: `1px solid ${a.premium ? "var(--premium)" : "var(--border)"}`,
              color: a.color,
              boxShadow: a.premium ? "var(--shadow-premium)" : "var(--shadow-sm)",
            }}
          >
            <Icon size={12} weight="fill" />
            {a.label}
          </Link>
        );
      })}
    </div>
  );
}
