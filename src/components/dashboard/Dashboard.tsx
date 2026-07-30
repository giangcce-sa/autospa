import Link from "next/link";
import type { Icon } from "@phosphor-icons/react/dist/lib/types";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@/components/ui/Badge";
import { actionStyles } from "@/components/ui/Button";
import { Surface } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

export function DashboardPage({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("dashboard-page max-w-none space-y-5", className)}>{children}</div>;
}

export function DashboardHeader({
  eyebrow,
  title,
  description,
  meta,
  actions,
  controls,
}: {
  eyebrow: string;
  title: string;
  description: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  controls?: React.ReactNode;
}) {
  return (
    <Surface as="header" padding="none" className="dashboard-command overflow-hidden">
      <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-start lg:justify-between lg:p-6">
        <div className="min-w-0 max-w-3xl">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--accent)]">{eyebrow}</p>
          <h1 className="mt-2 text-[28px] font-extrabold sm:text-[32px]">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
          {meta ? <div className="mt-3 text-xs leading-5 text-[var(--text-muted)]">{meta}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
      {controls ? <div className="border-t border-[var(--border)] bg-[var(--surface-subtle)] px-5 py-3 lg:px-6">{controls}</div> : null}
    </Surface>
  );
}

export function DashboardAction({ href, children, secondary = false }: { href: string; children: React.ReactNode; secondary?: boolean }) {
  return (
    <Link href={href} className={actionStyles({ variant: secondary ? "secondary" : "primary" })}>
      {children}<ArrowRight size={15} aria-hidden="true" />
    </Link>
  );
}

export function DashboardMetric({
  label,
  value,
  detail,
  icon: Icon,
  tone = "accent",
  unavailable = false,
  href,
}: {
  label: string;
  value: string | number;
  detail?: string;
  icon?: Icon;
  tone?: "accent" | "success" | "warning" | "danger" | "info";
  unavailable?: boolean;
  href?: string;
}) {
  const colors = {
    accent: ["var(--accent)", "var(--accent-light)"],
    success: ["var(--success)", "var(--success-light)"],
    warning: ["var(--warning)", "var(--warning-light)"],
    danger: ["var(--danger)", "var(--danger-light)"],
    info: ["var(--info)", "var(--info-light)"],
  } as const;
  const [color, background] = colors[tone];
  const content = (
    <Surface as="article" padding="compact" interactive={Boolean(href)} className="dashboard-metric h-full">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">{label}</p>
        {Icon ? <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)]" style={{ background, color }}><Icon size={16} weight="fill" aria-hidden="true" /></span> : null}
      </div>
      <p className={cn("mt-3 text-[26px] font-extrabold leading-none tabular-nums", unavailable && "text-[var(--text-muted)]")} style={unavailable ? undefined : { color: "var(--text)" }}>
        {typeof value === "number" ? value.toLocaleString("vi-VN") : value}
      </p>
      {detail ? <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">{detail}</p> : null}
    </Surface>
  );
  return href ? <Link href={href} className="block h-full rounded-[var(--radius-xl)] focus-visible:outline-none">{content}</Link> : content;
}

export function DashboardPanel({
  title,
  description,
  badge,
  action,
  children,
  className,
  padding = true,
}: {
  title: string;
  description?: string;
  badge?: { label: string; variant?: "default" | "success" | "warning" | "danger" | "info" | "neutral" };
  action?: { href: string; label: string };
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
}) {
  return (
    <Surface as="section" padding="none" className={cn("dashboard-panel overflow-hidden", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[16px] font-extrabold">{title}</h2>
            {badge ? <Badge variant={badge.variant}>{badge.label}</Badge> : null}
          </div>
          {description ? <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{description}</p> : null}
        </div>
        {action ? <Link href={action.href} className={actionStyles({ variant: "quiet", size: "sm" })}>{action.label}<ArrowRight size={13} aria-hidden="true" /></Link> : null}
      </div>
      <div className={padding ? "p-4 sm:p-5" : ""}>{children}</div>
    </Surface>
  );
}

export function DashboardStatusStrip({
  tone,
  title,
  detail,
  meta,
  action,
}: {
  tone: "success" | "warning" | "danger" | "info";
  title: string;
  detail: string;
  meta?: string;
  action?: { href: string; label: string };
}) {
  const styles = {
    success: ["var(--success)", "var(--success-light)"],
    warning: ["var(--warning)", "var(--warning-light)"],
    danger: ["var(--danger)", "var(--danger-light)"],
    info: ["var(--info)", "var(--info-light)"],
  } as const;
  const [color, background] = styles[tone];
  return (
    <Surface
      padding="compact"
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      style={{ borderColor: `color-mix(in srgb, ${color} 34%, var(--border))`, background: `color-mix(in srgb, ${background} 58%, var(--surface-card))`, boxShadow: "none" }}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} /><p className="text-sm font-bold">{title}</p></div>
        <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{detail}</p>
        {meta ? <p className="mt-1 text-[11px] text-[var(--text-muted)]">{meta}</p> : null}
      </div>
      {action ? <Link href={action.href} className={actionStyles({ variant: "quiet", size: "sm" })} style={{ color }}>{action.label}<ArrowRight size={13} aria-hidden="true" /></Link> : null}
    </Surface>
  );
}
