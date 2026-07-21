"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ImageSquare, Megaphone, NotePencil, Sparkle, VideoCamera, X } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const OPTIONS: Array<{ id: string; label: string; description: string; href: string; icon: Icon }> = [
  { id: "post", label: "Bài viết", description: "Nội dung bài đăng và thẻ chủ đề", href: "/content", icon: NotePencil },
  { id: "image", label: "Hình ảnh", description: "Ảnh dịch vụ hoặc nhân viên", href: "/images", icon: ImageSquare },
  { id: "video", label: "Video", description: "Kịch bản, giọng đọc và dựng video", href: "/video-studio", icon: VideoCamera },
  { id: "campaign", label: "Bộ nội dung", description: "Nhiều bài theo cùng một mục tiêu", href: "/bulk", icon: Megaphone },
];

export function CreateContentDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [selected, setSelected] = useState("video");
  const current = OPTIONS.find((item) => item.id === selected)!;
  const launch = () => { onClose(); router.push(current.href); };
  return (
    <div className={cn("fixed inset-0 z-50", open ? "pointer-events-auto" : "pointer-events-none")} aria-hidden={!open}>
      <button aria-label="Đóng trình tạo nội dung" onClick={onClose} className={cn("absolute inset-0 bg-[#14251b]/30 backdrop-blur-[2px] transition-opacity", open ? "opacity-100" : "opacity-0")} />
      <aside className={cn("absolute right-0 top-0 flex h-full w-full max-w-[34rem] flex-col bg-[var(--bg-card)] shadow-[-20px_0_50px_rgba(22,42,29,.14)] transition-transform duration-300", open ? "translate-x-0" : "translate-x-full")}>
        <header className="flex h-16 items-center justify-between border-b border-[var(--border)] px-5 sm:px-7"><div><p className="text-[12px] font-semibold text-[var(--accent)]">Bắt đầu nhanh</p><h2 className="text-lg font-bold">Tạo nội dung mới</h2></div><button onClick={onClose} className="rounded-md p-2 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]" aria-label="Đóng"><X size={19} /></button></header>
        <div className="flex-1 overflow-y-auto px-5 py-7 sm:px-7">
          <h3 className="text-xl font-bold">Bạn muốn tạo gì?</h3>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">AutoSpa sẽ mở đúng màn hình làm việc và giữ nguyên Trang Facebook đang chọn.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {OPTIONS.map((item) => { const ItemIcon = item.icon; const active = item.id === selected; return <button key={item.id} onClick={() => setSelected(item.id)} className={cn("min-h-32 rounded-lg border p-4 text-left transition-all", active ? "border-[var(--accent)] bg-[var(--accent-light)] shadow-[0_0_0_1px_var(--accent)]" : "border-[var(--border)] bg-[var(--bg-elevated)] hover:border-[var(--border-strong)]")}><ItemIcon size={24} weight={active ? "fill" : "regular"} className={active ? "text-[var(--accent)]" : "text-[var(--text-muted)]"} /><p className="mt-5 text-[15px] font-bold">{item.label}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{item.description}</p></button>; })}
          </div>
          <div className="mt-7 border-y border-[var(--border)] py-4"><p className="text-[13px] font-semibold">Bước tiếp theo</p><p className="mt-1 text-[13px] leading-6 text-[var(--text-muted)]">Chọn dịch vụ, mục tiêu và nhân viên. AutoSpa chỉ tạo bản nháp để bạn kiểm tra trước khi đăng.</p></div>
        </div>
        <footer className="flex items-center justify-between border-t border-[var(--border)] px-5 py-4 sm:px-7"><button onClick={onClose} className="h-10 px-2 text-sm font-semibold text-[var(--text-secondary)]">Hủy</button><button onClick={launch} className="flex h-10 items-center gap-2 rounded-md bg-[var(--accent)] px-5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] active:translate-y-px"><Sparkle size={16} />Mở {current.label.toLowerCase()}<ArrowRight size={16} /></button></footer>
      </aside>
    </div>
  );
}
