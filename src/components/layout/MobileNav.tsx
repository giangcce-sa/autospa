"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Gauge, Briefcase, PencilSimple, PaperPlaneTilt, Archive, Gear,
} from "@phosphor-icons/react";

const mobileNav = [
  { label: "Dashboard", href: "/", icon: Gauge },
  { label: "Dịch vụ", href: "/services", icon: Briefcase },
  { label: "Nội dung", href: "/content", icon: PencilSimple },
  { label: "Đăng bài", href: "/publish", icon: PaperPlaneTilt },
  { label: "Thư viện", href: "/library", icon: Archive },
  { label: "Cài đặt", href: "/settings", icon: Gear },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 md:hidden border-t"
      style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center justify-around px-2 py-2 safe-b">
        {mobileNav.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-colors"
            >
              <Icon
                size={20}
                weight={active ? "fill" : "regular"}
                color={active ? "var(--accent)" : "var(--text-muted)"}
              />
              <span
                className="text-[10px] font-medium"
                style={{ color: active ? "var(--accent)" : "var(--text-muted)" }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
