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
      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-card)]/92 px-4 backdrop-blur-md sm:px-7">
        <div className="flex min-w-0 items-center gap-2 md:hidden"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--accent)] text-[var(--accent-foreground)]"><Sparkle size={15} weight="fill" /></span><label className="min-w-0"><span className="sr-only">Trang Facebook đang chọn</span><select value={selectedPageId} onChange={(event) => setSelectedPageId(event.target.value)} className="h-9 max-w-[8.5rem] rounded-md border-0 bg-transparent pr-5 text-[13px] font-bold text-[var(--text)]"><option value="">AutoSpa</option>{pages.map((page) => <option key={page.id} value={page.id}>{page.pageName}</option>)}</select></label></div>
        <button type="button" onClick={openPalette} aria-label="Mở tìm kiếm nhanh" className="ml-auto flex h-10 min-w-10 items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 text-[13px] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-subtle)] lg:w-64 lg:justify-start lg:px-3"><MagnifyingGlass size={16} aria-hidden="true" /><span className="hidden lg:inline">Tìm khách hàng, nội dung...</span><kbd className="ml-auto hidden font-mono text-[11px] lg:inline">⌘K</kbd></button>
        <div className="ml-auto lg:ml-0"><NotificationBell /></div>
        <ThemeToggle />
        <button type="button" aria-label="Tạo nội dung" onClick={() => setCreateOpen(true)} className="flex h-10 items-center gap-2 rounded-md bg-[var(--accent)] px-3 text-[13px] font-semibold text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)] active:translate-y-px sm:px-3.5"><Plus size={17} weight="bold" /><span className="hidden sm:inline">Tạo nội dung</span></button>
      </header>
      <CreateContentDrawer open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
