import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
  width?: string | number;
  height?: string | number;
}

export function Skeleton({ className, style, width, height }: SkeletonProps) {
  return (
    <div
      className={cn("skeleton", className)}
      style={{ width, height, ...style }}
      aria-busy="true"
      aria-live="polite"
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl p-5 space-y-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

export function SkeletonStat() {
  return (
    <div className="rounded-xl p-4 space-y-2" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-2 w-full" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-3">
      <Skeleton className="h-8 w-8 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-2 w-1/3" />
      </div>
      <Skeleton className="h-3 w-12" />
    </div>
  );
}

export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div className="divide-y" style={{ borderColor: "var(--border)" }}>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

export function SkeletonChart({ bars = 30 }: { bars?: number }) {
  return (
    <div className="flex items-end gap-0.5 h-32">
      {Array.from({ length: bars }).map((_, i) => (
        <div key={i} className="flex-1" style={{ minWidth: 6 }}>
          <Skeleton style={{ height: `${30 + Math.random() * 70}%` }} className="w-full" />
        </div>
      ))}
    </div>
  );
}
