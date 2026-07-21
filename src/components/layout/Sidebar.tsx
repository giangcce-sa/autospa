"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartLineUp, GearSix, House, NotePencil, Sparkle, UsersThree } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { useSession } from "next-auth/react";
import { useActivePage } from "@/contexts/ActivePageContext";
import { UserMenu } from "./UserMenu";

type NavItem = { label: string; href: string; icon: Icon; routes: string[] };

export const PRIMARY_NAV: NavItem[] = [
  { label: "Hôm nay", href: "/", icon: House, routes: ["/"] },
  { label: "Sáng tạo", href: "/creative", icon: NotePencil, routes: ["/creative", "/content", "/images", "/video-studio", "/publish", "/library", "/bulk", "/ab-test", "/content-research", "/flash-deal", "/staff-visuals"] },
  { label: "Khách hàng", href: "/customers", icon: UsersThree, routes: ["/customers", "/inbox", "/sale", "/crm", "/care", "/appointments", "/auto-comment", "/zalo"] },
  { label: "Tăng trưởng", href: "/growth", icon: ChartLineUp, routes: ["/growth", "/reports", "/analytics", "/facebook-ads", "/promotions", "/competitors", "/listening", "/tiktok-ig", "/google-business", "/holidays"] },
  { label: "Hệ thống", href: "/system", icon: GearSix, routes: ["/system", "/settings", "/services", "/brand", "/brand-kit", "/brain", "/learning", "/style-training", "/automation", "/orchestrator", "/council", "/ceo-memory", "/skin-ai", "/stories"] },
];

export function navIsActive(pathname: string, item: NavItem) {
  if (item.href === "/") return pathname === "/";
  return item.routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { pages, selectedPageId, setSelectedPageId, selectedPage } = useActivePage();
  const name = session?.user?.name || session?.user?.email || "Tài khoản";

  return (
    <>
      <div className="hidden w-[15rem] shrink-0 md:block" />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[15rem] flex-col border-r border-[var(--border)] bg-[var(--bg-card)] px-3 py-4 md:flex">
        <Link href="/" className="flex h-11 items-center gap-3 px-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--accent)] text-white shadow-[0_8px_18px_rgba(47,111,84,.18)]"><Sparkle size={17} weight="fill" /></span>
          <span><span className="block text-base font-extrabold leading-tight">AutoSpa</span><span className="block text-[11px] font-medium text-[var(--text-muted)]">Trợ lý cho spa</span></span>
        </Link>

        <label className="mt-5 block">
          <span className="sr-only">Trang Facebook đang chọn</span>
          <select
            value={selectedPageId}
            onChange={(event) => setSelectedPageId(event.target.value)}
            className="h-11 w-full rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-[13px] font-semibold text-[var(--text)] shadow-[var(--shadow-sm)]"
          >
            {pages.length === 0 && <option value="">{selectedPage?.pageName || "Chưa kết nối Trang Facebook"}</option>}
            {pages.map((page) => <option key={page.id} value={page.id}>{page.pageName}</option>)}
          </select>
        </label>

        <nav className="mt-7 space-y-1" aria-label="Điều hướng chính">
          {PRIMARY_NAV.slice(0, 4).map((item) => {
            const IconComponent = item.icon;
            const active = navIsActive(pathname, item);
            return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`flex h-11 items-center gap-3 rounded-md px-3 text-[15px] font-semibold transition-colors ${active ? "bg-[var(--accent-light)] text-[var(--accent)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text)]"}`}><IconComponent size={19} weight={active ? "fill" : "regular"} />{item.label}</Link>;
          })}
        </nav>

        <div className="mt-auto border-t border-[var(--border)] pt-4">
          {(() => { const item = PRIMARY_NAV[4]; const IconComponent = item.icon; const active = navIsActive(pathname, item); return <Link href={item.href} aria-current={active ? "page" : undefined} className={`flex h-11 items-center gap-3 rounded-md px-3 text-[15px] font-semibold transition-colors ${active ? "bg-[var(--accent-light)] text-[var(--accent)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text)]"}`}><IconComponent size={19} weight={active ? "fill" : "regular"} />{item.label}</Link>; })()}
          <div className="mt-3 flex items-center gap-3 px-3 py-2"><UserMenu /><div className="min-w-0"><p className="truncate text-[13px] font-semibold">{name}</p><p className="text-[11px] text-[var(--text-muted)]">Chủ sở hữu</p></div></div>
        </div>
      </aside>
    </>
  );
}
