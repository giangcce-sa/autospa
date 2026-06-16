"use client";

import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { CommandPaletteButton } from "./CommandPalette";
import { NotificationBell } from "./NotificationBell";
import { MagnifyingGlass } from "@phosphor-icons/react";

const titles: Record<string, string> = {
  "/": "Tổng quan",
  "/services": "Quản lý Dịch vụ",
  "/content": "Tạo Nội dung",
  "/images": "Tạo Hình ảnh",
  "/quality": "Kiểm soát Chất lượng",
  "/publish": "Đăng bài",
  "/library": "Thư viện & Lịch",
  "/inbox": "Auto Inbox",
  "/appointments": "Yêu cầu Đặt lịch",
  "/brand": "Thương hiệu",
  "/style-training": "Style Training",
  "/settings": "Cài đặt",
};

export function Header() {
  const pathname = usePathname();
  const title = titles[pathname] ?? "AutoSpa";

  const openPalette = () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }));
  };

  return (
    <header
      className="sticky top-0 z-20 flex items-center justify-between px-4 h-12 border-b backdrop-blur-sm"
      style={{ background: "color-mix(in srgb, var(--bg-card) 92%, transparent)", borderColor: "var(--border)" }}
    >
      <h1 className="font-semibold text-sm md:hidden" style={{ color: "var(--text)" }}>{title}</h1>

      {/* Desktop: search bar centered */}
      <div className="hidden md:flex flex-1 items-center">
        <CommandPaletteButton />
      </div>

      <div className="flex items-center gap-2">
        {/* Mobile: search icon */}
        <button
          onClick={openPalette}
          className="md:hidden p-1.5 rounded-lg transition-opacity hover:opacity-70"
          style={{ color: "var(--text-muted)" }}
          aria-label="Tìm kiếm"
        >
          <MagnifyingGlass size={18} />
        </button>
        <NotificationBell />
        <ThemeToggle />
      </div>
    </header>
  );
}
