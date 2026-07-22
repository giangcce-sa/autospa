"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkle } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { useSession } from "next-auth/react";
import { ROUTE_ICONS } from "@/config/route-icons";
import { SECTIONS, sectionIsActive } from "@/config/routes";
import { useActivePage } from "@/contexts/ActivePageContext";
import { UserMenu } from "./UserMenu";

export type NavItem = { label: string; href: string; icon: Icon };

export const PRIMARY_NAV: NavItem[] = SECTIONS.map((section) => ({
  label: section.label,
  href: section.href,
  icon: ROUTE_ICONS[section.icon],
}));

export function navIsActive(pathname: string, item: NavItem) {
  const section = SECTIONS.find((candidate) => candidate.href === item.href);
  return section ? sectionIsActive(pathname, section.id) : false;
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { pages, selectedPageId, setSelectedPageId, selectedPage } = useActivePage();
  const user = session?.user as { name?: string | null; email?: string | null; role?: string } | undefined;
  const name = user?.name || user?.email || "Tài khoản";
  const roleLabel = user?.role === "owner" ? "Chủ sở hữu" : "Người xem";

  return (
    <>
      <div className="hidden w-[15rem] shrink-0 md:block" />
      <aside data-app-sidebar className="fixed inset-y-0 left-0 z-30 hidden w-[15rem] flex-col border-r border-[var(--border)] bg-[var(--bg-card)] px-3 py-4 md:flex">
        <Link href="/" className="flex h-11 items-center gap-3 px-2" aria-label="AutoSpa — Hôm nay">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--accent)] text-[var(--accent-foreground)] shadow-[0_8px_18px_rgba(47,111,84,.18)]"><Sparkle size={17} weight="fill" /></span>
          <span><span className="block text-base font-extrabold leading-tight">AutoSpa</span><span className="block text-xs font-medium text-[var(--text-muted)]">Trợ lý cho spa</span></span>
        </Link>

        <label className="mt-5 block">
          <span className="mb-1.5 block text-xs font-semibold text-[var(--text-muted)]">Trang Facebook</span>
          <select
            value={selectedPageId}
            onChange={(event) => setSelectedPageId(event.target.value)}
            className="h-11 w-full rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-[13px] font-semibold text-[var(--text)] shadow-[var(--shadow-sm)]"
          >
            <option value="">{pages.length === 0 ? selectedPage?.pageName || "Chưa kết nối Trang" : "Tất cả Trang"}</option>
            {pages.map((page) => <option key={page.id} value={page.id}>{page.pageName}</option>)}
          </select>
        </label>

        <nav className="mt-7 space-y-1" aria-label="Điều hướng chính">
          {PRIMARY_NAV.slice(0, 4).map((item) => <SidebarLink key={item.href} item={item} pathname={pathname} />)}
        </nav>

        <div className="mt-auto border-t border-[var(--border)] pt-4">
          <SidebarLink item={PRIMARY_NAV[4]} pathname={pathname} />
          <div className="mt-3 flex items-center gap-3 px-3 py-2"><UserMenu /><div className="min-w-0"><p className="truncate text-[13px] font-semibold">{name}</p><p className="text-xs text-[var(--text-muted)]">{roleLabel}</p></div></div>
        </div>
      </aside>
    </>
  );
}

function SidebarLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const IconComponent = item.icon;
  const active = navIsActive(pathname, item);
  return (
    <Link href={item.href} aria-current={active ? "page" : undefined} className={`flex h-11 items-center gap-3 rounded-md px-3 text-[15px] font-semibold transition-colors ${active ? "bg-[var(--accent-light)] text-[var(--accent)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text)]"}`}>
      <IconComponent size={19} weight={active ? "fill" : "regular"} />
      {item.label}
    </Link>
  );
}
