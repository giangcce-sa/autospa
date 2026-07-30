import Link from "next/link";
import type { ReactNode } from "react";
import { actionStyles } from "@/components/ui/Button";
import { Surface } from "@/components/ui/Card";

export type Tone = "purple" | "blue" | "rose" | "green" | "amber" | "danger" | "muted";

export const TONE_CHIP: Record<Tone, string> = {
  purple: "bg-[var(--purple-light)] text-[var(--purple)]",
  blue: "bg-[var(--blue-light)] text-[var(--blue)]",
  rose: "bg-[var(--rose-light)] text-[var(--rose)]",
  green: "bg-[var(--green-light)] text-[var(--green)]",
  amber: "bg-[var(--amber-light)] text-[var(--amber)]",
  danger: "bg-[var(--danger-light)] text-[var(--danger)]",
  muted: "bg-[var(--bg-subtle)] text-[var(--text-muted)]",
};

/** Working area + context rail, for list-centric studio overviews. */
export function StudioWithRail({ rail, children }: { rail: ReactNode; children: ReactNode }) {
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,19rem)]">
      <div className="min-w-0">{children}</div>
      {rail}
    </div>
  );
}

/** 3-column studio: master list · working area · context rail. */
export function StudioGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)_minmax(0,19rem)]">
      {children}
    </div>
  );
}

export function StudioPanel({
  title,
  meta,
  link,
  padding = "md",
  className = "",
  children,
}: {
  title?: string;
  meta?: string;
  link?: { href: string; label: string };
  padding?: "sm" | "md";
  className?: string;
  children: ReactNode;
}) {
  return (
    <Surface as="section" padding={padding === "sm" ? "compact" : "default"} className={className}>
      {(title || link) && (
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            {title && <h3 className="truncate text-[14px] font-bold">{title}</h3>}
            {meta && <p className="mt-0.5 truncate text-[11.5px] text-[var(--text-muted)]">{meta}</p>}
          </div>
          {link && (
            <Link href={link.href} className={actionStyles({ variant: "quiet", size: "sm", className: "shrink-0" })}>
              {link.label}
            </Link>
          )}
        </div>
      )}
      {children}
    </Surface>
  );
}

/** Compact label/value rows for a context rail. */
export function StatRows({ rows }: { rows: Array<{ label: string; value: string; tone?: Tone }> }) {
  return (
    <ul className="space-y-1.5">
      {rows.map((row) => (
        <li key={row.label} className="flex items-center justify-between gap-3 text-[12.5px]">
          <span className="min-w-0 truncate text-[var(--text-secondary)]">{row.label}</span>
          <span className={`shrink-0 font-bold tabular-nums ${row.tone ? toneText(row.tone) : ""}`}>{row.value}</span>
        </li>
      ))}
    </ul>
  );
}

function toneText(tone: Tone) {
  const map: Record<Tone, string> = {
    purple: "text-[var(--purple)]",
    blue: "text-[var(--blue)]",
    rose: "text-[var(--rose)]",
    green: "text-[var(--green)]",
    amber: "text-[var(--amber)]",
    danger: "text-[var(--danger)]",
    muted: "text-[var(--text-muted)]",
  };
  return map[tone];
}

export function StudioTag({ label, tone = "muted" }: { label: string; tone?: Tone }) {
  return (
    <span className={`shrink-0 rounded-[5px] px-2 py-0.5 text-[10.5px] font-bold ${TONE_CHIP[tone]}`}>{label}</span>
  );
}

export function StudioEmpty({ text }: { text: string }) {
  return <p className="py-5 text-center text-[12.5px] text-[var(--text-muted)]">{text}</p>;
}

/** A distribution bar for "N of total" style breakdowns. */
export function StudioBars({
  rows,
  total,
}: {
  rows: Array<{ label: string; count: number; tone?: Tone }>;
  total: number;
}) {
  const safeTotal = total > 0 ? total : 1;
  return (
    <ul className="space-y-2.5">
      {rows.map((row) => (
        <li key={row.label} className="grid grid-cols-[5.5rem_1fr_2.5rem] items-center gap-2.5">
          <span className="truncate text-[12px] font-semibold text-[var(--text-secondary)]">{row.label}</span>
          <span className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
            <span
              className="block h-full rounded-full"
              style={{
                width: `${Math.round((row.count / safeTotal) * 100)}%`,
                background: `var(--${row.tone ?? "purple"})`,
              }}
            />
          </span>
          <span className="text-right text-[12px] font-bold tabular-nums">{row.count}</span>
        </li>
      ))}
    </ul>
  );
}
