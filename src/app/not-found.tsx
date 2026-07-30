import Link from "next/link";
import { Compass } from "@phosphor-icons/react/dist/ssr";
import { actionStyles } from "@/components/ui/Button";
import { Surface } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export default function NotFound() {
  return (
    <Surface className="mx-auto max-w-2xl">
      <EmptyState
        density="page"
        icon={<Compass size={28} weight="duotone" aria-hidden="true" />}
        title="Khu vực này không tồn tại"
        description="404 — Đường dẫn có thể đã thay đổi hoặc bạn mở một liên kết không còn được sử dụng."
        action={<Link href="/" className={actionStyles()}>Về Hôm nay</Link>}
        secondaryAction={<Link href="/creative" className={actionStyles({ variant: "secondary" })}>Mở danh mục công việc</Link>}
      />
    </Surface>
  );
}
