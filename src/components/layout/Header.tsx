"use client";

import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { CommandPaletteButton } from "./CommandPalette";
import { NotificationBell } from "./NotificationBell";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { useExperienceMode } from "@/contexts/ExperienceModeContext";

const titles: Record<string, string> = {
  "/": "Tổng quan",
  "/brain": "AutoSpa Brain",
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
  const { mode, setMode } = useExperienceMode();

  const openPalette = () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }));
  };

  return (
    <header
      className="sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6 h-14 border-b backdrop-blur-md"
      style={{ background: "color-mix(in srgb, var(--bg-card) 88%, transparent)", borderColor: "var(--border)" }}
    >
      <h1 className="font-semibold text-sm md:hidden" style={{ color: "var(--text)" }}>{title}</h1>

      {/* Desktop: search bar centered */}
      <div className="hidden md:flex flex-1 items-center">
        <CommandPaletteButton />
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden sm:flex items-center p-0.5 rounded-md" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
          {(["simple", "advanced"] as const).map((item) => (
            <button
              key={item}
              onClick={() => setMode(item)}
              className="px-3 py-1.5 rounded-[6px] text-xs font-semibold transition-all"
              style={mode === item
                ? { background: "var(--bg-card)", color: item === "advanced" ? "var(--premium)" : "var(--accent)", boxShadow: "var(--shadow-sm)" }
                : { color: "var(--text-muted)" }}
            >
              {item === "simple" ? "Đơn giản" : "Nâng cao"}
            </button>
          ))}
        </div>
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
