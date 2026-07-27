"use client";

import Link from "next/link";
import { getCanonicalRouteHref } from "@/config/routes";
import {
  PencilSimple, Tag, ArrowsClockwise, FloppyDisk, Image as ImageIcon,
  CheckCircle, Flame, Robot,
} from "@phosphor-icons/react";

const APPROVALS_HREF = getCanonicalRouteHref("automation", "approvals");
const CONTENT_HREF = getCanonicalRouteHref("content");

const ACTIONS = [
  { label: "Duyệt việc", href: APPROVALS_HREF, icon: CheckCircle, color: "var(--premium)", premium: true },
  { label: "Chăm lead", href: "/sale", icon: Flame, color: "var(--rose)" },
  { label: "Viết bài AI", href: CONTENT_HREF, icon: PencilSimple, color: "var(--accent)" },
  { label: "Tạo khuyến mãi", href: "/promotions", icon: Tag, color: "var(--amber)" },
  { label: "Tạo ảnh", href: getCanonicalRouteHref("images"), icon: ImageIcon, color: "var(--blue)" },
  { label: "Run AI team", href: getCanonicalRouteHref("orchestrator"), icon: Robot, color: "var(--premium)", premium: true },
  { label: "Sync đối thủ", href: "/competitors", icon: ArrowsClockwise, color: "var(--text-secondary)" },
  { label: "Backup", href: "/settings", icon: FloppyDisk, color: "var(--text-secondary)" },
];

export function QuickActions({ simple = false }: { simple?: boolean }) {
  const actions = simple
    ? ACTIONS.filter((action) => [APPROVALS_HREF, "/sale", CONTENT_HREF, "/promotions"].includes(action.href))
    : ACTIONS;

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a) => {
        const Icon = a.icon;
        return (
          <Link
            key={a.href + a.label}
            href={a.href}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold transition-all hover:-translate-y-px"
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
