"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PRIMARY_NAV, navIsActive } from "./Sidebar";

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav data-mobile-nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-[var(--border)] bg-[var(--bg-card)]/95 px-1 pb-[max(.35rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur-md md:hidden" aria-label="Điều hướng mobile">
      {PRIMARY_NAV.map((item) => {
        const IconComponent = item.icon;
        const active = navIsActive(pathname, item);
        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-[var(--radius-md)] px-1 text-[10px] font-semibold transition-colors ${active ? "bg-[var(--accent-light)] text-[var(--accent)]" : "text-[var(--text-muted)] hover:bg-[var(--surface-subtle)]"}`}>
            <IconComponent size={19} weight={active ? "fill" : "regular"} aria-hidden="true" />
            <span className="max-w-full truncate text-[11px]">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
