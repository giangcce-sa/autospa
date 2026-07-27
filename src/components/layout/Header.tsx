"use client";

import { useState } from "react";
import { MagnifyingGlass, Plus, Sparkle } from "@phosphor-icons/react";
import { NotificationBell } from "./NotificationBell";
import { CreateContentDrawer } from "./CreateContentDrawer";
import { ThemeToggle } from "./ThemeToggle";
import { useActivePage } from "@/contexts/ActivePageContext";

export function Header() {
  const [createOpen, setCreateOpen] = useState(false);
  const { pages, selectedPageId, setSelectedPageId } = useActivePage();
  const openPalette = () => window.dispatchEvent(new Event("autospa:open-command-palette"));
  return (
    <>
      <header className="sticky top-0 z-20 flex h-[68px] items-center gap-2.5 border-b border-[var(--border)] bg-[var(--bg)]/92 px-4 backdrop-blur-md sm:px-6">
        <div className="flex min-w-0 items-center gap-2 md:hidden"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-gradient-to-br from-[var(--accent)] to-[var(--accent-hover)] text-white"><Sparkle size={15} weight="fill" /></span><label className="min-w-0"><span className="sr-only">Trang Facebook đang chọn</span><select value={selectedPageId} onChange={(event) => setSelectedPageId(event.target.value)} className="h-9 max-w-[8.5rem] rounded-md border-0 bg-transparent pr-5 text-[13px] font-bold text-[var(--text)]"><option value="">AutoSpa</option>{pages.map((page) => <option key={page.id} value={page.id}>{page.pageName}</option>)}</select></label></div>
        <button type="button" onClick={openPalette} aria-label="Mở tìm kiếm nhanh" className="ml-auto flex h-[38px] min-w-[38px] items-center justify-center gap-2 rounded-[9px] border border-[var(--border-strong)] bg-[var(--bg-card)] px-2.5 text-[13px] text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--text)] lg:w-[420px] lg:justify-start lg:px-3"><MagnifyingGlass size={16} aria-hidden="true" /><span className="hidden lg:inline">Tìm khách hàng, nội dung, chiến dịch</span><kbd className="ml-auto hidden rounded-[5px] border border-[var(--border-strong)] px-1.5 font-mono text-[11px] lg:inline">⌘K</kbd></button>
        <div className="ml-auto lg:ml-0"><NotificationBell /></div>
        <ThemeToggle />
        <button type="button" aria-label="Tạo nội dung" onClick={() => setCreateOpen(true)} className="flex h-[38px] items-center gap-2 rounded-[9px] bg-[var(--accent)] px-3 text-[13px] font-bold text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)] active:translate-y-px sm:px-4"><Plus size={17} weight="bold" /><span className="hidden sm:inline">Tạo nội dung</span></button>
      </header>
      <CreateContentDrawer open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
