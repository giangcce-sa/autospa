"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function HorizontalScroller({
  children,
  className,
  contentClassName,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  label?: string;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const maxScroll = viewport.scrollWidth - viewport.clientWidth;
    setEdges({ left: viewport.scrollLeft > 2, right: viewport.scrollLeft < maxScroll - 2 });
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const active = viewport.querySelector<HTMLElement>("[aria-current='page'], [aria-selected='true']");
    active?.scrollIntoView({ behavior: "instant", block: "nearest", inline: "nearest" });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [children, measure]);

  return (
    <div className={cn("relative min-w-0", className)}>
      <div
        ref={viewportRef}
        className={cn("overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", contentClassName)}
        aria-label={label}
        onScroll={measure}
      >
        {children}
      </div>
      <span aria-hidden="true" className={cn("pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-[var(--surface-card)] to-transparent transition-opacity", edges.left ? "opacity-100" : "opacity-0")} />
      <span aria-hidden="true" className={cn("pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-[var(--surface-card)] to-transparent transition-opacity", edges.right ? "opacity-100" : "opacity-0")} />
    </div>
  );
}
