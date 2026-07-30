import { Surface } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="max-w-none space-y-5" role="status" aria-busy="true" aria-label="Đang tải trang">
      <Surface padding="none" className="overflow-hidden">
        <div className="p-5 lg:p-6">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-3 h-9 w-80 max-w-full" />
          <Skeleton className="mt-3 h-4 w-full max-w-2xl" />
          <Skeleton className="mt-2 h-4 w-2/3 max-w-lg" />
        </div>
        <div className="flex gap-2 border-t border-[var(--border)] bg-[var(--surface-subtle)] px-5 py-3">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-24" />
        </div>
      </Surface>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => <Surface key={item} padding="compact"><Skeleton className="h-3 w-1/2" /><Skeleton className="mt-4 h-8 w-2/3" /><Skeleton className="mt-3 h-3 w-full" /></Surface>)}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]">
        <Surface><Skeleton className="h-5 w-44" /><Skeleton className="mt-5 h-72 w-full" /></Surface>
        <Surface><Skeleton className="h-5 w-36" /><Skeleton className="mt-5 h-72 w-full" /></Surface>
      </div>
      <span className="sr-only">Đang tải nội dung</span>
    </div>
  );
}
