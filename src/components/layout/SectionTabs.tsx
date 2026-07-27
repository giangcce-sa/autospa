"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ROUTE_ICONS } from "@/config/route-icons";
import { APP_ROUTES, routeIsActive, type AppSectionId } from "@/config/routes";

/**
 * Top-level tab strip for a section's workspaces (e.g. the 5 Sáng tạo studios).
 * Carries the current page scope across tabs so switching studio keeps context.
 */
export function SectionTabs({ sectionId }: { sectionId: AppSectionId }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabs = APP_ROUTES.filter((route) => route.section === sectionId && route.kind === "workspace");
  if (tabs.length < 2) return null;

  const scope = searchParams.get("scope");
  const pageId = searchParams.get("pageId");

  return (
    <nav
      className="-mx-1 flex gap-1 overflow-x-auto border-b border-[var(--border)] px-1 pb-px"
      aria-label="Khu vực sáng tạo"
    >
      {tabs.map((tab) => {
        const IconComponent = ROUTE_ICONS[tab.icon];
        const active = routeIsActive(pathname, tab.path);
        const params = new URLSearchParams();
        if (scope) params.set("scope", scope);
        if (pageId) params.set("pageId", pageId);
        const href = params.size ? `${tab.path}?${params.toString()}` : tab.path;
        return (
          <Link
            key={tab.id}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 shrink-0 items-center gap-2 rounded-t-[10px] border-b-2 px-3.5 text-[13.5px] font-semibold transition-colors ${
              active
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text)]"
            }`}
          >
            <IconComponent size={17} weight={active ? "fill" : "regular"} aria-hidden="true" />
            {tab.label}
            {tab.premium && (
              <span className="rounded-[4px] bg-[var(--premium-light)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--premium)]">
                Pro
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
