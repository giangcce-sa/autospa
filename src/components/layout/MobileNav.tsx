"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Gauge, ChatCircleDots, Flame, Archive, DotsThree,
  PencilSimple, PaperPlaneTilt, Tag, Image, Stack,
  ChartBar, Eye, ChartLine, UsersThree, Lightning,
  Gear, Briefcase, Buildings, Palette, Brain, BookOpen, Scan,
  Robot, ChatsTeardrop, ArrowsSplit, Megaphone, Sparkle, X,
} from "@phosphor-icons/react";

const CORE = [
  { label: "Home", href: "/", icon: Gauge },
  { label: "Inbox", href: "/inbox", icon: ChatCircleDots },
  { label: "Sale", href: "/sale", icon: Flame },
  { label: "Thư viện", href: "/library", icon: Archive },
];

const MORE_GROUPS = [
  {
    label: "AI Agents",
    items: [
      { label: "Orchestrator", href: "/orchestrator", icon: Robot, premium: true },
      { label: "AI Council", href: "/council", icon: ChatsTeardrop, premium: true },
      { label: "CEO Memory", href: "/ceo-memory", icon: Brain, premium: true },
    ],
  },
  {
    label: "Nội dung",
    items: [
      { label: "Viết bài", href: "/content", icon: PencilSimple },
      { label: "Đăng bài", href: "/publish", icon: PaperPlaneTilt },
      { label: "Flash Deal", href: "/promotions", icon: Tag },
      { label: "Hình ảnh AI", href: "/images", icon: Image },
      { label: "Hàng loạt", href: "/bulk", icon: Stack },
      { label: "Nghiên cứu", href: "/content-research", icon: Sparkle },
      { label: "A/B Test", href: "/ab-test", icon: ArrowsSplit },
    ],
  },
  {
    label: "Quảng cáo",
    items: [
      { label: "FB Ads", href: "/facebook-ads", icon: Megaphone },
      { label: "Analytics", href: "/analytics", icon: ChartBar },
      { label: "Listening", href: "/listening", icon: Eye },
      { label: "Báo cáo", href: "/reports", icon: ChartLine },
    ],
  },
  {
    label: "Khách hàng",
    items: [
      { label: "CRM", href: "/crm", icon: UsersThree },
      { label: "Zalo OA", href: "/zalo", icon: Lightning },
    ],
  },
  {
    label: "Thiết lập",
    items: [
      { label: "Cài đặt", href: "/settings", icon: Gear },
      { label: "Dịch vụ", href: "/services", icon: Briefcase },
      { label: "Thương hiệu", href: "/brand", icon: Buildings },
      { label: "Brand Kit", href: "/brand-kit", icon: Palette },
      { label: "Style AI", href: "/style-training", icon: Brain },
      { label: "Câu chuyện", href: "/stories", icon: BookOpen },
      { label: "Da liễu AI", href: "/skin-ai", icon: Scan },
    ],
  },
];

export function MobileNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      {/* Bottom bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 md:hidden border-t"
        style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center justify-around px-2 py-2">
          {CORE.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-1 px-3 py-1 rounded-lg"
              >
                <Icon size={20} weight={active ? "fill" : "regular"} color={active ? "var(--accent)" : "var(--text-muted)"} />
                <span className="text-[10px] font-medium" style={{ color: active ? "var(--accent)" : "var(--text-muted)" }}>
                  {item.label}
                </span>
              </Link>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center gap-1 px-3 py-1 rounded-lg"
          >
            <DotsThree size={20} weight="bold" color={moreOpen ? "var(--accent)" : "var(--text-muted)"} />
            <span className="text-[10px] font-medium" style={{ color: moreOpen ? "var(--accent)" : "var(--text-muted)" }}>Thêm</span>
          </button>
        </div>
      </nav>

      {/* More sheet */}
      {moreOpen && (
        <>
          <div
            className="fixed inset-0 z-40 md:hidden"
            style={{ background: "rgba(0,0,0,0.4)" }}
            onClick={() => setMoreOpen(false)}
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 md:hidden rounded-t-2xl overflow-y-auto"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)", maxHeight: "80vh" }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
              <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>Tất cả tính năng</p>
              <button onClick={() => setMoreOpen(false)} className="p-1.5 rounded-lg transition-opacity hover:opacity-70" style={{ color: "var(--text-muted)" }}>
                <X size={16} />
              </button>
            </div>

            <div className="px-4 py-3 space-y-5 pb-8">
              {MORE_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>{group.label}</p>
                  <div className="grid grid-cols-4 gap-2">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = pathname === item.href;
                      const isPremium = "premium" in item && item.premium;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMoreOpen(false)}
                          className="flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors"
                          style={{
                            background: active
                              ? isPremium ? "var(--premium-light)" : "var(--accent-light)"
                              : "var(--bg-subtle)",
                          }}
                        >
                          <Icon
                            size={18}
                            weight="fill"
                            style={{ color: active ? (isPremium ? "var(--premium)" : "var(--accent)") : "var(--text-secondary)" }}
                          />
                          <span
                            className="text-[10px] font-medium text-center leading-tight"
                            style={{ color: active ? (isPremium ? "var(--premium)" : "var(--accent)") : "var(--text)" }}
                          >
                            {item.label}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
