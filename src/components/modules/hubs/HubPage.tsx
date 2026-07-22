"use client";

import Link from "next/link";
import { ArrowRight, Sparkle } from "@phosphor-icons/react";
import { ROUTE_ICONS } from "@/config/route-icons";
import { getSection, getSectionRoutes, ROUTES_BY_ID, type AppRoute, type AppSectionId } from "@/config/routes";
import { useExperienceMode } from "@/contexts/ExperienceModeContext";
import { SystemModeControl } from "./SystemModeControl";

interface HubPageProps {
  sectionId: Exclude<AppSectionId, "today">;
  relatedToolIds?: string[];
  systemMode?: boolean;
}

export function HubPage({ sectionId, relatedToolIds = [], systemMode = false }: HubPageProps) {
  const { mode } = useExperienceMode();
  const section = getSection(sectionId);
  const visible = (route: AppRoute) => route.visibility === "simple" || mode === "advanced";
  const primary = getSectionRoutes(sectionId, "primary").filter(visible);
  const ownTools = getSectionRoutes(sectionId, "tool");
  const relatedTools = relatedToolIds.flatMap((id) => {
    const route = ROUTES_BY_ID.get(id);
    return route ? [route] : [];
  });
  const tools = [...ownTools, ...relatedTools].filter(visible);

  if (!section) return null;

  return (
    <div className="max-w-6xl">
      <header className="border-b border-[var(--border)] pb-6">
        <p className="mb-2 text-[13px] font-semibold text-[var(--accent)]">Khu vực làm việc</p>
        <h1 className="text-[30px] font-extrabold">{section.label}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">{section.description}</p>
      </header>

      {systemMode && <SystemModeControl />}

      <section className="mt-8" aria-labelledby={`${sectionId}-primary-heading`}>
        <h2 id={`${sectionId}-primary-heading`} className="text-lg font-bold">Công việc chính</h2>
        <div className="mt-3 grid gap-px overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--border)] md:grid-cols-2">
          {primary.map((route) => <HubLink key={route.id} route={route} />)}
        </div>
      </section>

      {tools.length > 0 && (
        <section className="mt-9" aria-labelledby={`${sectionId}-tools-heading`}>
          <div className="flex items-center gap-2"><h2 id={`${sectionId}-tools-heading`} className="text-lg font-bold">Công cụ hỗ trợ</h2><Sparkle size={16} className="text-[var(--text-muted)]" aria-hidden="true" /></div>
          <div className="mt-3 divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {tools.map((route) => <HubToolLink key={route.id} route={route} />)}
          </div>
        </section>
      )}

      {mode === "simple" && sectionId !== "system" && (
        <p className="mt-8 text-[13px] leading-5 text-[var(--text-muted)]">Các công cụ chuyên sâu đang được ẩn trong chế độ Đơn giản. Bạn có thể đổi chế độ tại khu vực Hệ thống.</p>
      )}
    </div>
  );
}

function HubLink({ route }: { route: AppRoute }) {
  const ItemIcon = ROUTE_ICONS[route.icon];
  return (
    <Link href={route.path} className="group flex min-h-36 items-start gap-4 bg-[var(--bg-card)] p-5 transition-colors hover:bg-[var(--accent-soft)]">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[var(--accent-light)] text-[var(--accent)]"><ItemIcon size={21} weight="duotone" /></span>
      <span className="min-w-0 flex-1"><span className="block text-[15px] font-bold">{route.label}</span><span className="mt-1 block text-[13px] leading-5 text-[var(--text-muted)]">{route.description}</span><span className="mt-4 flex items-center gap-1 text-xs font-semibold text-[var(--accent)]">Mở công cụ <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" /></span></span>
    </Link>
  );
}

function HubToolLink({ route }: { route: AppRoute }) {
  const ItemIcon = ROUTE_ICONS[route.icon];
  return (
    <Link href={route.path} className="grid gap-3 py-4 transition-colors hover:bg-[var(--bg-subtle)] sm:grid-cols-[2.75rem_minmax(0,1fr)_8rem_auto] sm:items-center sm:px-2">
      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--bg-subtle)] text-[var(--text-secondary)]"><ItemIcon size={18} /></span>
      <span><span className="block text-sm font-semibold">{route.label}</span><span className="mt-1 block text-[13px] leading-5 text-[var(--text-muted)]">{route.description}</span></span>
      <span className="text-xs font-medium text-[var(--accent)]">{route.premium ? "AI nâng cao" : "Sẵn sàng"}</span>
      <ArrowRight size={16} className="text-[var(--text-muted)]" aria-hidden="true" />
    </Link>
  );
}
