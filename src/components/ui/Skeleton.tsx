import { Surface } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
  width?: string | number;
  height?: string | number;
}

export function Skeleton({ className, style, width, height }: SkeletonProps) {
  return <div className={cn("skeleton", className)} style={{ width, height, ...style }} aria-hidden="true" />;
}

export function SkeletonCard() {
  return (
    <Surface className="space-y-3">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
      <Skeleton className="h-3 w-2/3" />
    </Surface>
  );
}

export function SkeletonStat() {
  return (
    <Surface padding="compact" className="space-y-2">
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-8 w-3/4" />
      <Skeleton className="h-2 w-full" />
    </Surface>
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
    <div className="divide-y divide-[var(--border)]">
      {Array.from({ length: rows }).map((_, index) => <SkeletonRow key={index} />)}
    </div>
  );
}

export function SkeletonChart({ bars = 30 }: { bars?: number }) {
  return (
    <div className="flex h-32 items-end gap-0.5">
      {Array.from({ length: bars }).map((_, index) => (
        <div key={index} className="flex-1" style={{ minWidth: 6 }}>
          <Skeleton style={{ height: `${30 + ((index * 37) % 70)}%` }} className="w-full" />
        </div>
      ))}
    </div>
  );
}
