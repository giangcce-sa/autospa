"use client";

import { useEffect } from "react";

const UNSAVED_MESSAGE = "Bạn có thay đổi chưa lưu. Rời trang và bỏ các thay đổi này?";

export function UnsavedChangesGuard({ active }: { active: boolean }) {
  useEffect(() => {
    if (!active) return;

    const beforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    const navigate = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const target = new URL(anchor.href, window.location.href);
      if (target.origin !== window.location.origin || target.href === window.location.href) return;
      if (!window.confirm(UNSAVED_MESSAGE)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", navigate, true);
    };
  }, [active]);

  return null;
}
