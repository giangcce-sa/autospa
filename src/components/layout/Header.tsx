"use client";

import { useState } from "react";
import { MagnifyingGlass, Plus, Sparkle } from "@phosphor-icons/react";
import { NotificationBell } from "./NotificationBell";
import { CreateContentDrawer } from "./CreateContentDrawer";
import { actionStyles } from "@/components/ui/Button";
import { ThemeToggle } from "./ThemeToggle";
import { useActivePage } from "@/contexts/ActivePageContext";

export function Header() {
  const [createOpen, setCreateOpen] = useState(false);
  const { pages, selectedPageId, setSelectedPageId } = useActivePage();
  const openPalette = () => window.dispatchEvent(new Event("autospa:open-command-palette"));
  return (
    <>
      <header className="sticky top-0 z-20 flex min-h-[68px] items-center gap-2 border-b border-[var(--border)] bg-[var(--bg)]/92 px-3 py-2 backdrop-blur-md sm:gap-2.5 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2 md:hidden">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-gradient-to-br from-[var(--accent)] to-[var(--accent-hover)] text-white"><Sparkle size={15} weight="fill" aria-hidden="true" /></span>
          <label className="min-w-0 flex-1"><span className="sr-only">Trang Facebook đang chọn</span><select value={selectedPageId} onChange={(event) => setSelectedPageId(event.target.value)} className="min-h-11 w-full max-w-[9.5rem] truncate rounded-[var(--radius-md)] border-0 bg-transparent pr-7 text-[13px] font-bold text-[var(--text)]"><option value="">AutoSpa</option>{pages.map((page) => <option key={page.id} value={page.id}>{page.pageName}</option>)}</select></label>
        </div>
        <button type="button" onClick={openPalette} aria-label="Mở tìm kiếm nhanh" className="flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-card)] px-2.5 text-[13px] text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text)] md:ml-auto lg:w-[420px] lg:justify-start lg:px-3"><MagnifyingGlass size={17} aria-hidden="true" /><span className="hidden lg:inline">Tìm khách hàng, nội dung, chiến dịch</span><kbd className="ml-auto hidden rounded-[5px] border border-[var(--border-strong)] px-1.5 font-mono text-[11px] lg:inline">⌘K</kbd></button>
        <NotificationBell />
        <ThemeToggle />
        <button type="button" aria-label="Tạo nội dung" onClick={() => setCreateOpen(true)} className={actionStyles({ className: "min-w-11 px-0 sm:px-4" })}><Plus size={17} weight="bold" aria-hidden="true" /><span className="hidden sm:inline">Tạo nội dung</span></button>
      </header>
      <CreateContentDrawer open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
