import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="max-w-6xl" aria-busy="true" aria-label="Đang tải trang">
      <div className="border-b border-[var(--border)] pb-6">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mt-3 h-9 w-72 max-w-full" />
        <Skeleton className="mt-3 h-4 w-full max-w-2xl" />
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-36 w-full" />
      </div>
      <span className="sr-only">Đang tải nội dung</span>
    </div>
  );
}
