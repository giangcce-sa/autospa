"use client";

import { useState } from "react";
import { MagnifyingGlass, Plus, Sparkle } from "@phosphor-icons/react";
import { NotificationBell } from "./NotificationBell";
import { CreateContentDrawer } from "./CreateContentDrawer";
import { useActivePage } from "@/contexts/ActivePageContext";

export function Header() {
  const [createOpen, setCreateOpen] = useState(false);
  const { pages, selectedPageId, setSelectedPageId } = useActivePage();
  const openPalette = () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }));
  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-card)]/92 px-4 backdrop-blur-md sm:px-7">
        <div className="flex min-w-0 items-center gap-2 md:hidden"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--accent)] text-white"><Sparkle size={15} weight="fill" /></span><label className="min-w-0"><span className="sr-only">Trang Facebook đang chọn</span><select value={selectedPageId} onChange={(event) => setSelectedPageId(event.target.value)} className="h-9 max-w-[8.5rem] rounded-md border-0 bg-transparent pr-5 text-[13px] font-bold text-[var(--text)]"><option value="">AutoSpa</option>{pages.map((page) => <option key={page.id} value={page.id}>{page.pageName}</option>)}</select></label></div>
        <button onClick={openPalette} className="ml-auto hidden h-9 w-64 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-[13px] text-[var(--text-muted)] lg:flex"><MagnifyingGlass size={15} />Tìm khách hàng, nội dung...</button>
        <div className="ml-auto lg:ml-0"><NotificationBell /></div>
        <button aria-label="Tạo nội dung" onClick={() => setCreateOpen(true)} className="flex h-10 items-center gap-2 rounded-md bg-[var(--accent)] px-3 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] active:translate-y-px sm:px-3.5"><Plus size={17} weight="bold" /><span className="hidden sm:inline">Tạo nội dung</span></button>
      </header>
      <CreateContentDrawer open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
