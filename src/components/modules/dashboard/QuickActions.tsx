"use client";

import Link from "next/link";
import {
  PencilSimple, Tag, ArrowsClockwise, FloppyDisk, Image as ImageIcon,
  CheckCircle, Flame, Robot,
} from "@phosphor-icons/react";

const ACTIONS = [
  { label: "Duyệt việc", href: "/automation", icon: CheckCircle, color: "var(--premium)", premium: true },
  { label: "Chăm lead", href: "/sale", icon: Flame, color: "var(--rose)" },
  { label: "Viết bài AI", href: "/content", icon: PencilSimple, color: "var(--accent)" },
  { label: "Tạo promo", href: "/promotions", icon: Tag, color: "var(--amber)" },
  { label: "Tạo ảnh", href: "/images", icon: ImageIcon, color: "var(--blue)" },
  { label: "Run AI team", href: "/orchestrator", icon: Robot, color: "var(--premium)", premium: true },
  { label: "Sync đối thủ", href: "/competitors", icon: ArrowsClockwise, color: "var(--text-secondary)" },
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
