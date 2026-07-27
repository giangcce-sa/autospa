"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { MediaThumbnail } from "./MediaThumbnail";

export function MediaPreviewDialog({
  open,
  onOpenChange,
  title,
  description,
  kind = "image",
  mediaUrl,
  posterUrl,
  aspectRatio,
  details,
  actions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string | null;
  kind?: "image" | "video";
  mediaUrl?: string | null;
  posterUrl?: string | null;
  aspectRatio?: string | null;
  details?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* Scrim derives from the sidebar ink so it belongs to the palette. */}
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[var(--side)]/75 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-x-3 top-1/2 z-50 max-h-[92vh] -translate-y-1/2 overflow-y-auto rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-card)] shadow-[var(--shadow-lg)] sm:left-1/2 sm:right-auto sm:w-[min(92vw,70rem)] sm:-translate-x-1/2">
          <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--border)] bg-[var(--bg-card)] px-4 py-3">
            <div className="min-w-0">
              <Dialog.Title className="truncate text-[16px] font-extrabold tracking-tight text-[var(--text)]">{title}</Dialog.Title>
              {description && <Dialog.Description className="mt-0.5 line-clamp-2 text-[12px] text-[var(--text-muted)]">{description}</Dialog.Description>}
            </div>
            <Dialog.Close className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[9px] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text)]" aria-label="Đóng xem trước">
              <X size={20} aria-hidden="true" />
            </Dialog.Close>
          </div>
          <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="flex min-h-72 items-center justify-center overflow-hidden rounded-[11px] bg-[var(--side)]">
              {kind === "video" && mediaUrl && !mediaUrl.startsWith("mock://") ? (
                <video src={mediaUrl} poster={posterUrl ?? undefined} controls className="max-h-[72vh] max-w-full" />
              ) : (
                <MediaThumbnail src={mediaUrl ?? posterUrl} alt={title} kind={kind} aspectRatio={aspectRatio} className="max-h-[72vh] w-full" />
              )}
            </div>
            <aside className="space-y-4">
              {details}
              {actions && <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-4">{actions}</div>}
            </aside>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
