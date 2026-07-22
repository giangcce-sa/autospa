"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { Command } from "cmdk";
import * as Dialog from "@radix-ui/react-dialog";
import { ROUTE_ICONS } from "@/config/route-icons";
import { getCommandRoutes, getSection, type AppRoute, type AppSectionId } from "@/config/routes";
import { useExperienceMode } from "@/contexts/ExperienceModeContext";

const GROUP_ORDER: readonly AppSectionId[] = ["today", "creative", "customers", "growth", "system"];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const triggerRef = useRef<HTMLElement | null>(null);
  const { mode } = useExperienceMode();
  const router = useRouter();

  const routes = useMemo(
    () => getCommandRoutes().filter((route) => route.visibility === "simple" || mode === "advanced"),
    [mode],
  );

  const close = useCallback(() => {
    setOpen(false);
    setSearch("");
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  const onSelect = useCallback((route: AppRoute) => {
    router.push(route.path);
    close();
  }, [close, router]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (!event.repeat && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (open) {
          close();
        } else {
          triggerRef.current = document.activeElement as HTMLElement | null;
          setOpen(true);
        }
      }
    };
    const handleOpen = () => {
      triggerRef.current = document.activeElement as HTMLElement | null;
      setOpen(true);
    };

    window.addEventListener("keydown", handleKey);
    window.addEventListener("autospa:open-command-palette", handleOpen);

    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("autospa:open-command-palette", handleOpen);
    };
  }, [close, open]);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={(next) => next ? setOpen(true) : close()}
      label="Tìm trang và tính năng"
      loop
      overlayClassName="fixed inset-0 z-50 bg-[rgba(19,24,20,0.48)] backdrop-blur-sm"
      contentClassName="fixed left-1/2 top-[12vh] z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-[var(--shadow-lg)]"
    >
      <Dialog.Title className="sr-only">Tìm trang và tính năng</Dialog.Title>
      <Dialog.Description className="sr-only">Tìm và mở nhanh một khu vực trong AutoSpa.</Dialog.Description>
      <div className="flex min-h-14 items-center gap-3 border-b border-[var(--border)] px-4">
        <MagnifyingGlass size={18} className="shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
        <Command.Input
          value={search}
          onValueChange={setSearch}
          placeholder="Tìm trang, khách hàng hoặc công cụ..."
          className="h-14 min-w-0 flex-1 bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
        />
        <kbd className="rounded border border-[var(--border)] bg-[var(--bg-subtle)] px-2 py-1 font-mono text-[11px] text-[var(--text-muted)]">Esc</kbd>
      </div>

      <Command.List label="Kết quả tìm kiếm" className="max-h-[min(65vh,34rem)] overflow-y-auto p-2">
        <Command.Empty className="px-4 py-12 text-center text-[13px] text-[var(--text-muted)]">Không tìm thấy trang hoặc tính năng phù hợp.</Command.Empty>
        {GROUP_ORDER.map((sectionId) => {
          const section = getSection(sectionId);
          const groupRoutes = routes.filter((route) => route.section === sectionId);
          if (!section || groupRoutes.length === 0) return null;
          return (
            <Command.Group key={sectionId} heading={section.label} className="command-group mb-2">
              {groupRoutes.map((route) => <CommandRouteItem key={route.id} route={route} onSelect={() => onSelect(route)} />)}
            </Command.Group>
          );
        })}
      </Command.List>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[var(--border)] px-4 py-2.5 text-[11px] text-[var(--text-muted)]">
        <span><kbd className="font-mono">↑↓</kbd> điều hướng</span>
        <span><kbd className="font-mono">Enter</kbd> mở</span>
        <span><kbd className="font-mono">Esc</kbd> đóng</span>
      </div>
    </Command.Dialog>
  );
}

function CommandRouteItem({ route, onSelect }: { route: AppRoute; onSelect: () => void }) {
  const Icon = ROUTE_ICONS[route.icon];
  return (
    <Command.Item
      value={`${route.label} ${route.description}`}
      keywords={route.searchAliases}
      onSelect={onSelect}
      className="flex min-h-12 cursor-default select-none items-center gap-3 rounded-md px-3 py-2 text-left outline-none data-[selected=true]:bg-[var(--accent-light)] data-[selected=true]:text-[var(--accent)]"
    >
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${route.premium ? "bg-[var(--premium-light)] text-[var(--premium)]" : "bg-[var(--bg-subtle)] text-[var(--text-secondary)]"}`}>
        <Icon size={16} weight="duotone" />
      </span>
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{route.label}</span><span className="block truncate text-xs text-[var(--text-muted)]">{route.description}</span></span>
      {route.premium && <span className="rounded bg-[var(--premium-light)] px-2 py-0.5 text-[10px] font-bold text-[var(--premium)]">AI</span>}
    </Command.Item>
  );
}

export function CommandPaletteButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("autospa:open-command-palette"))}
      className="hidden min-h-9 items-center gap-2 rounded-md border border-[var(--border)] px-3 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-subtle)] sm:flex"
      aria-label="Mở tìm kiếm nhanh"
    >
      <MagnifyingGlass size={14} aria-hidden="true" />
      Tìm kiếm
      <kbd className="font-mono text-[11px]">⌘K</kbd>
    </button>
  );
}
