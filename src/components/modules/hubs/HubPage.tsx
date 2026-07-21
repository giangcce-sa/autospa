import Link from "next/link";
import { ArrowRight, Sparkle } from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { SystemModeControl } from "./SystemModeControl";

export interface HubItem { title: string; description: string; href: string; icon: Icon; status?: string }

export function HubPage({ title, description, primary, tools, systemMode = false }: { title: string; description: string; primary: HubItem[]; tools: HubItem[]; systemMode?: boolean }) {
  return (
    <div className="max-w-6xl">
      <header className="border-b border-[var(--border)] pb-6"><p className="mb-2 text-[13px] font-semibold text-[var(--accent)]">Khu vực làm việc</p><h1 className="text-[30px] font-extrabold">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">{description}</p></header>

      {systemMode && <SystemModeControl />}

      <section className="mt-8"><h2 className="text-lg font-bold">Công việc chính</h2><div className="mt-3 grid overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--border)] md:grid-cols-2">{primary.map((item) => <HubLink key={item.href} item={item} />)}</div></section>

      <section className="mt-9"><div className="flex items-center gap-2"><h2 className="text-lg font-bold">Công cụ hỗ trợ</h2><Sparkle size={16} className="text-[var(--text-muted)]" /></div><div className="mt-3 divide-y divide-[var(--border)] border-y border-[var(--border)]">{tools.map((item) => { const ItemIcon = item.icon; return <Link key={item.href} href={item.href} className="grid gap-3 py-4 transition-colors hover:bg-[var(--bg-subtle)] sm:grid-cols-[2.5rem_minmax(0,1fr)_12rem_auto] sm:items-center sm:px-2"><span className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--bg-subtle)] text-[var(--text-secondary)]"><ItemIcon size={18} /></span><span><span className="block text-sm font-semibold">{item.title}</span><span className="mt-1 block text-xs text-[var(--text-muted)]">{item.description}</span></span><span className="text-xs font-medium text-[var(--accent)]">{item.status || "Sẵn sàng"}</span><ArrowRight size={16} className="text-[var(--text-muted)]" /></Link>; })}</div></section>
    </div>
  );
}

function HubLink({ item }: { item: HubItem }) {
  const ItemIcon = item.icon;
  return <Link href={item.href} className="group flex min-h-32 items-start gap-4 bg-[var(--bg-card)] p-5 transition-colors hover:bg-[var(--accent-soft)]"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[var(--accent-light)] text-[var(--accent)]"><ItemIcon size={21} weight="duotone" /></span><span className="min-w-0 flex-1"><span className="block text-[15px] font-bold">{item.title}</span><span className="mt-1 block text-[13px] leading-5 text-[var(--text-muted)]">{item.description}</span><span className="mt-4 flex items-center gap-1 text-xs font-semibold text-[var(--accent)]">Mở công cụ <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" /></span></span></Link>;
}
