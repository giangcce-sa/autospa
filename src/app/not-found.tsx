import Link from "next/link";
import { Compass } from "@phosphor-icons/react/dist/ssr";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-6 py-14 text-center shadow-[var(--shadow-sm)]">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--accent-light)] text-[var(--accent)]"><Compass size={28} weight="duotone" /></span>
      <p className="mt-5 text-[13px] font-semibold text-[var(--accent)]">404 — Không tìm thấy trang</p>
      <h1 className="mt-2 text-[28px] font-extrabold">Khu vực này không tồn tại</h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--text-secondary)]">Đường dẫn có thể đã thay đổi hoặc bạn mở một liên kết không còn được sử dụng.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/" className="inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)]">Về Hôm nay</Link>
        <Link href="/creative" className="inline-flex min-h-11 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-4 text-sm font-semibold text-[var(--text)] hover:bg-[var(--bg-subtle)]">Mở danh mục công việc</Link>
      </div>
    </div>
  );
}
