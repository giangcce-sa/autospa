"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CaretRight, Sparkle } from "@phosphor-icons/react";
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
      <div className="hidden w-[var(--sidebar-width)] shrink-0 md:block" />
      <aside
        data-app-sidebar
        className="fixed inset-y-0 left-0 z-30 hidden w-[var(--sidebar-width)] flex-col bg-[var(--side)] px-3.5 py-4 md:flex"
      >
        <Link href="/" className="flex items-center gap-2.5 px-2 pb-3.5" aria-label="AutoSpa — Hôm nay">
          <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-gradient-to-br from-[var(--accent)] to-[var(--accent-hover)] text-white">
            <Sparkle size={19} weight="fill" />
          </span>
          <span className="text-[19px] font-extrabold leading-none tracking-tight text-white">AutoSpa</span>
        </Link>

        <nav className="space-y-0.5" aria-label="Điều hướng chính">
          {PRIMARY_NAV.map((item, index) => (
            <SidebarLink key={item.href} item={item} index={index + 1} pathname={pathname} />
          ))}
        </nav>

        <p className="mt-5 px-2.5 pb-2 text-[10.5px] font-bold uppercase tracking-[0.1em] text-[var(--side-ink-2)]">
          Trang Facebook
        </p>
        <label className="block px-0.5">
          <span className="sr-only">Trang Facebook đang chọn</span>
          <select
            value={selectedPageId}
            onChange={(event) => setSelectedPageId(event.target.value)}
            className="h-10 w-full rounded-[10px] border-0 bg-[var(--side-2)] px-3 text-[13px] font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            <option value="">{pages.length === 0 ? selectedPage?.pageName || "Chưa kết nối Trang" : "Tất cả Trang"}</option>
            {pages.map((page) => (
              <option key={page.id} value={page.id}>{page.pageName}</option>
            ))}
          </select>
        </label>

        <div className="mt-auto space-y-3 pt-4">
          <div className="flex items-center gap-2.5 rounded-[11px] bg-[var(--side-2)] p-2.5">
            <UserMenu />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold text-white">{name}</p>
              <p className="text-[11px] text-[var(--side-ink-2)]">{roleLabel}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function SidebarLink({ item, index, pathname }: { item: NavItem; index: number; pathname: string }) {
  const IconComponent = item.icon;
  const active = navIsActive(pathname, item);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`shell-nav-item flex h-11 items-center gap-2.5 rounded-[10px] px-3 text-[14px] font-semibold ${active ? "" : "text-[var(--side-ink)]"}`}
    >
      <IconComponent size={19} weight={active ? "fill" : "regular"} aria-hidden="true" />
      <span className="truncate">{index}. {item.label}</span>
      {!active && <CaretRight size={14} className="ml-auto shrink-0 opacity-50" aria-hidden="true" />}
    </Link>
  );
}
