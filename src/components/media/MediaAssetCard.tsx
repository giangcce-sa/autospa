import type { ReactNode } from "react";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";
import { MediaThumbnail } from "./MediaThumbnail";

export function MediaAssetCard({
  title,
  description,
  thumbnailUrl,
  thumbnailAlt,
  kind = "image",
  aspectRatio,
  selected = false,
  badges,
  metadata,
  actions,
  onSelect,
}: {
  title: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  thumbnailAlt?: string;
  kind?: "image" | "video";
  aspectRatio?: string | null;
  selected?: boolean;
  badges?: ReactNode;
  metadata?: ReactNode;
  actions?: ReactNode;
  onSelect?: () => void;
}) {
  const content = (
    <>
      <div className="relative">
        <MediaThumbnail src={thumbnailUrl} alt={thumbnailAlt ?? title} kind={kind} aspectRatio={aspectRatio} />
        {selected && (
          <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow" aria-label="Đang chọn">
            <CheckCircle size={18} weight="fill" aria-hidden="true" />
          </span>
        )}
      </div>
      <div className="space-y-2 p-3">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-[13px] font-bold leading-snug text-[var(--text)]">{title}</h3>
          {badges && <div className="flex shrink-0 flex-wrap justify-end gap-1">{badges}</div>}
        </div>
        {description && <p className="line-clamp-2 text-[11.5px] leading-relaxed text-[var(--text-secondary)]">{description}</p>}
        {metadata && <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] tabular-nums text-[var(--text-muted)]">{metadata}</div>}
        {actions && <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-2">{actions}</div>}
      </div>
    </>
  );

  const className = cn(
    "overflow-hidden rounded-[var(--radius-lg)] border bg-[var(--bg-card)] text-left shadow-[var(--shadow-sm)] transition-[border-color,box-shadow,transform] motion-reduce:transition-none",
    onSelect && "hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] motion-reduce:hover:translate-y-0",
    selected ? "border-[var(--accent)] ring-2 ring-[var(--brand-ring)]" : "border-[var(--border)]",
  );

  if (!onSelect) return <article className={className}>{content}</article>;
  if (actions) {
    return (
      <article className={cn(className, "relative")}>
        <button type="button" onClick={onSelect} aria-pressed={selected} aria-label={title} className="absolute inset-0 z-10 rounded-[var(--radius-lg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]" />
        <div className="relative z-20 pointer-events-none [&_button]:pointer-events-auto [&_a]:pointer-events-auto">{content}</div>
      </article>
    );
  }

  return (
    <button type="button" onClick={onSelect} aria-pressed={selected} className={cn(className, "w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]")}>
      {content}
    </button>
  );
}
