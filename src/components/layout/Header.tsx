"use client";

import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

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

  return (
    <header
      className="sticky top-0 z-20 flex items-center justify-between px-5 h-14 border-b backdrop-blur-sm md:hidden"
      style={{ background: "color-mix(in srgb, var(--bg-card) 90%, transparent)", borderColor: "var(--border)" }}
    >
      <h1 className="font-semibold text-base" style={{ color: "var(--text)" }}>{title}</h1>
      <ThemeToggle />
    </header>
  );
}
