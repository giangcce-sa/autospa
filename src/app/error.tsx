"use client";

import { useEffect } from "react";
import { WarningCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { Surface } from "@/components/ui/Card";
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
    <Surface className="mx-auto max-w-2xl">
      <ErrorState
        density="page"
        icon={<WarningCircle size={26} weight="duotone" />}
        title="Không thể tải khu vực này"
        description={error.digest ? `AutoSpa đã ghi nhận lỗi với mã ${error.digest}. Bạn có thể thử tải lại.` : "AutoSpa gặp lỗi tạm thời khi hiển thị dữ liệu. Bạn có thể thử tải lại."}
        action={<Button onClick={() => unstable_retry()}>Thử lại</Button>}
      />
    </Surface>
  );
}
