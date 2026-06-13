"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Gauge, Briefcase, PencilSimple, Image, CheckCircle,
  PaperPlaneTilt, Archive, ChatCircleDots, Buildings,
  Brain, Gear, Sparkle, CalendarStar, Stack, ChartBar,
  Palette, Lightning, ChatTeardropDots, UsersThree,
  Heart, Megaphone, Robot, ChartLine, Scan,
} from "@phosphor-icons/react";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "@/lib/utils";

const navGroups = [
  {
    label: "Tổng quan",
    items: [
      { label: "Dashboard", href: "/", icon: Gauge },
    ],
  },
  {
    label: "Nội dung",
    items: [
      { label: "Tạo nội dung", href: "/content", icon: PencilSimple },
      { label: "Tạo hình ảnh", href: "/images", icon: Image },
      { label: "Bulk Generation", href: "/bulk", icon: Stack },
      { label: "Lịch dịp đặc biệt", href: "/holidays", icon: CalendarStar },
      { label: "Kiểm soát CL", href: "/quality", icon: CheckCircle },
      { label: "Đăng bài", href: "/publish", icon: PaperPlaneTilt },
      { label: "Thư viện", href: "/library", icon: Archive },
    ],
  },
  {
    label: "Tương tác",
    items: [
      { label: "Auto Inbox", href: "/inbox", icon: ChatCircleDots },
      { label: "Auto Comment", href: "/auto-comment", icon: ChatTeardropDots },
      { label: "Zalo OA", href: "/zalo", icon: Lightning },
    ],
  },
  {
    label: "Khách hàng",
    items: [
      { label: "Mini CRM", href: "/crm", icon: UsersThree },
      { label: "Chăm sóc KH", href: "/care", icon: Heart },
      { label: "Chốt Sale AI", href: "/sale", icon: Robot },
    ],
  },
  {
    label: "Phân tích",
    items: [
      { label: "Analytics", href: "/analytics", icon: ChartBar },
      { label: "Social Listening", href: "/listening", icon: Megaphone },
      { label: "Báo cáo thông minh", href: "/reports", icon: ChartLine },
    ],
  },
  {
    label: "Cấu hình",
    items: [
      { label: "Dịch vụ", href: "/services", icon: Briefcase },
      { label: "Thương hiệu", href: "/brand", icon: Buildings },
      { label: "Brand Kit", href: "/brand-kit", icon: Palette },
      { label: "Style Training", href: "/style-training", icon: Brain },
      { label: "AI Da", href: "/skin-ai", icon: Scan },
      { label: "Cài đặt", href: "/settings", icon: Gear },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="fixed left-0 top-0 h-full flex-col border-r z-30 hidden md:flex overflow-y-auto"
      style={{ width: "var(--sidebar-width)", background: "var(--bg-card)", borderColor: "var(--border)" }}
    >
      <div className="p-4 border-b sticky top-0 z-10" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--accent)" }}>
            <Sparkle size={16} weight="fill" color="white" />
          </div>
          <div>
            <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>AutoSpa</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Marketing Tool</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-2 space-y-4 pb-4">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn("flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150")}
                    style={{
                      background: active ? "var(--accent)" : "transparent",
                      color: active ? "white" : "var(--text-secondary)",
                    }}
                  >
                    <Icon size={15} weight={active ? "fill" : "regular"} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t sticky bottom-0 flex items-center justify-between" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>v2.0.0</span>
        <ThemeToggle />
      </div>
    </aside>
  );
}
