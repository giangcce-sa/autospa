"use client";

import { useEffect, useId, useRef } from "react";
import { cn } from "@/lib/utils";

export interface PopoverTriggerProps {
  ref: React.Ref<HTMLButtonElement>;
  "aria-expanded": boolean;
  "aria-controls": string;
  "aria-haspopup": "dialog";
  onClick: () => void;
}

export function Popover({
  open,
  onOpenChange,
  trigger,
  children,
  align = "right",
  className,
  label,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: (props: PopoverTriggerProps) => React.ReactNode;
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
  label: string;
}) {
  const contentId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onOpenChange(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      onOpenChange(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onOpenChange, open]);

  return (
    <div ref={rootRef} className="relative">
      {trigger({
        ref: triggerRef,
        "aria-expanded": open,
        "aria-controls": contentId,
        "aria-haspopup": "dialog",
        onClick: () => onOpenChange(!open),
      })}
      {open ? (
        <div
          id={contentId}
          role="dialog"
          aria-label={label}
          className={cn(
            "absolute z-50 mt-2 max-w-[calc(100vw-2rem)] overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface-card)] shadow-[var(--overlay-shadow)]",
            align === "right" ? "right-0" : "left-0",
            className,
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
