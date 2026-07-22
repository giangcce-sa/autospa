"use client";

import { useEffect } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/EmptyState";

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl rounded-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-[var(--shadow-sm)]">
      <ErrorState
        icon={<WarningCircle size={24} weight="duotone" />}
        title="Không thể tải khu vực này"
        description={error.digest ? `AutoSpa đã ghi nhận lỗi với mã ${error.digest}. Bạn có thể thử tải lại.` : "AutoSpa gặp lỗi tạm thời khi hiển thị dữ liệu. Bạn có thể thử tải lại."}
        action={<Button onClick={() => unstable_retry()}>Thử lại</Button>}
      />
    </div>
  );
}
