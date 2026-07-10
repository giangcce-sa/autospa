"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Gauge, PencilSimple, Megaphone, UsersThree, Gear,
  Robot, ChatsTeardrop, Brain, PaperPlaneTilt, Archive,
  Tag, Sparkle, Image, Stack, ArrowsSplit, ChartBar,
  TrendUp, Eye, ChartLine, ChatCircleDots, Flame,
  Lightning, ChatTeardropDots, Briefcase, Buildings,
  Palette, Scan, BookOpen, SidebarSimple, MagnifyingGlass,
} from "@phosphor-icons/react";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";
import { useActivePage } from "@/contexts/ActivePageContext";
import { useExperienceMode } from "@/contexts/ExperienceModeContext";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  premium?: boolean;
}

interface Section {
  id: string;
  label: string;
  icon: React.ElementType;
  color?: string;
  basic: NavItem[];    // shown in Basic mode
  expert: NavItem[];   // shown only in Expert mode (additional)
}

// ─── Navigation structure ─────────────────────────────────────────────────────

const SECTIONS: Section[] = [
  {
    id: "core",
    label: "AI Core",
    icon: Gauge,
    color: "var(--premium)",
    basic: [
      { label: "Dashboard", href: "/", icon: Gauge },
      { label: "Brain", href: "/brain", icon: Brain, premium: true },
    ],
    expert: [
      { label: "Orchestrator", href: "/orchestrator", icon: Robot, premium: true },
      { label: "AI Council", href: "/council", icon: ChatsTeardrop, premium: true },
      { label: "CEO Memory", href: "/ceo-memory", icon: Brain, premium: true },
      { label: "Self-Learning", href: "/learning", icon: Brain, premium: true },
    ],
  },
  {
    id: "content",
    label: "Nội dung",
    icon: PencilSimple,
    color: "var(--accent)",
    basic: [
      { label: "Viết bài", href: "/content", icon: PencilSimple },
      { label: "Đăng & Lịch", href: "/publish", icon: PaperPlaneTilt },
      { label: "Thư viện", href: "/library", icon: Archive },
    ],
    expert: [
      { label: "Slot trống", href: "/flash-deal", icon: Tag },
      { label: "Nghiên cứu", href: "/content-research", icon: Sparkle },
      { label: "Tạo ảnh AI", href: "/images", icon: Image },
      { label: "Hàng loạt", href: "/bulk", icon: Stack },
      { label: "A/B Test", href: "/ab-test", icon: ArrowsSplit },
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    icon: Megaphone,
    color: "var(--warning)",
    basic: [
      { label: "Báo cáo", href: "/reports", icon: ChartLine },
    ],
    expert: [
      { label: "Facebook Ads", href: "/facebook-ads", icon: Megaphone },
      { label: "Phân tích", href: "/analytics", icon: ChartBar },
      { label: "TikTok / IG", href: "/tiktok-ig", icon: Sparkle },
      { label: "Google Business", href: "/google-business", icon: MagnifyingGlass },
      { label: "Intelligence", href: "/competitors", icon: TrendUp },
      { label: "Listening", href: "/listening", icon: Eye },
    ],
  },
  {
    id: "customers",
    label: "Khách hàng",
    icon: UsersThree,
    color: "var(--rose)",
    basic: [
      { label: "Tin nhắn", href: "/inbox", icon: ChatCircleDots },
      { label: "Chốt Sale", href: "/sale", icon: Flame },
      { label: "CRM", href: "/crm", icon: UsersThree },
    ],
    expert: [
      { label: "Zalo OA", href: "/zalo", icon: Lightning },
      { label: "Bình luận", href: "/auto-comment", icon: ChatTeardropDots },
    ],
  },
  {
    id: "settings",
    label: "Thiết lập",
    icon: Gear,
    basic: [
      { label: "Cài đặt", href: "/settings", icon: Gear },
      { label: "Dịch vụ", href: "/services", icon: Briefcase },
      { label: "Thương hiệu", href: "/brand", icon: Buildings },
      { label: "Duyệt việc", href: "/automation", icon: Lightning },
    ],
    expert: [
      { label: "Brand Kit", href: "/brand-kit", icon: Palette },
      { label: "Style Training", href: "/style-training", icon: Brain },
      { label: "AI Da liễu", href: "/skin-ai", icon: Scan },
      { label: "Câu chuyện", href: "/stories", icon: BookOpen },
    ],
  },
];

const STORAGE_SECTION = "sidebar-section";
const STORAGE_COLLAPSED = "sidebar-icon-only";

// ─── NavLink ──────────────────────────────────────────────────────────────────

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;

  const activeStyle = item.premium
    ? { background: "var(--premium-light)", color: "var(--premium)", boxShadow: "none" }
    : { background: "var(--accent-light)", color: "var(--accent)", boxShadow: "none" };

  const idleStyle = item.premium
    ? { color: "var(--premium)" }
    : { color: "var(--text-secondary)" };

  return (
    <Link
      href={item.href}
      className="flex items-center gap-2.5 rounded-md font-semibold text-[13px] px-2.5 py-2 transition-all duration-200 hover:bg-[var(--bg-subtle)]"
      style={active ? activeStyle : idleStyle}
    >
      <Icon size={14} weight={active ? "fill" : "regular"} style={{ flexShrink: 0 }} />
      <span className="truncate flex-1">{item.label}</span>
    </Link>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname();
  const { pages, selectedPageId, setSelectedPageId } = useActivePage();
  const { mode, setMode } = useExperienceMode();

  const [collapsed, setCollapsed] = useState(false);
  const [activeId, setActiveId] = useState(SECTIONS[0].id);

  // Load from localStorage
  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_COLLAPSED) === "1") setCollapsed(true);
      const savedSection = localStorage.getItem(STORAGE_SECTION);
      if (savedSection) setActiveId(savedSection);
    } catch { /* ignore */ }
  }, []);

  // Auto-switch section when navigating via URL
  useEffect(() => {
    for (const section of SECTIONS) {
      const all = [...section.basic, ...section.expert];
      if (all.some((i) => i.href === pathname || (pathname !== "/" && i.href !== "/" && pathname.startsWith(i.href)))) {
        setActiveId(section.id);
        break;
      }
    }
  }, [pathname]);

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      try { localStorage.setItem(STORAGE_COLLAPSED, v ? "0" : "1"); } catch { /* ignore */ }
      return !v;
    });
  };

  const selectSection = (id: string) => {
    setActiveId(id);
    try { localStorage.setItem(STORAGE_SECTION, id); } catch { /* ignore */ }
    // Expand if collapsed
    if (collapsed) {
      setCollapsed(false);
      try { localStorage.setItem(STORAGE_COLLAPSED, "0"); } catch { /* ignore */ }
    }
  };

  const toggleMode = () => {
    setMode(mode === "simple" ? "advanced" : "simple");
  };

  const activeSection = SECTIONS.find((s) => s.id === activeId) ?? SECTIONS[0];
  const visibleItems = mode === "advanced"
    ? [...activeSection.basic, ...activeSection.expert]
    : activeSection.basic;
  const hiddenCount = activeSection.expert.length;

  const sidebarWidth = collapsed ? "var(--sidebar-width-collapsed)" : "var(--sidebar-width)";

  return (
    <>
      {/* Layout spacer */}
      <div className="hidden md:block shrink-0 transition-all duration-200" style={{ width: sidebarWidth }} />

      <aside
        className="fixed left-0 top-0 h-full z-30 hidden md:flex flex-row border-r overflow-hidden transition-all duration-200"
        style={{ width: sidebarWidth, background: "color-mix(in srgb, var(--bg-card) 94%, var(--bg-subtle))", borderColor: "var(--border)" }}
      >
        {/* ── Activity Bar (left icon strip) ── */}
        <div
          className="flex flex-col items-center py-2 shrink-0 border-r"
          style={{ width: "var(--sidebar-width-collapsed)", borderColor: "var(--border)" }}
        >
          {/* Logo */}
          <div
            className="logo-icon w-9 h-9 rounded-md flex items-center justify-center mb-4 cursor-default shrink-0"
            style={{
              background: "var(--accent)",
              boxShadow: "0 10px 20px rgba(47,111,84,0.22)",
            }}
          >
            <Sparkle size={15} weight="fill" color="white" />
          </div>

          {/* Section icons */}
          <div className="flex flex-col gap-1 flex-1 w-full px-2">
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              const isActive = section.id === activeId;
              const hasCurrentRoute = [...section.basic, ...section.expert].some(
                (i) => i.href === pathname || (pathname !== "/" && i.href !== "/" && pathname.startsWith(i.href))
              );

              return (
                <button
                  key={section.id}
                  onClick={() => selectSection(section.id)}
                  title={section.label}
                  className="relative flex flex-col items-center justify-center w-full py-2.5 rounded-md transition-all duration-200 group hover:bg-[var(--bg-subtle)]"
                  style={{
                    background: isActive ? "var(--bg-subtle)" : "transparent",
                    color: isActive ? (section.color ?? "var(--accent)") : "var(--text-muted)",
                  }}
                >
                  {/* Active indicator bar */}
                  {isActive && (
                    <div
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                      style={{ background: section.color ?? "var(--accent)" }}
                    />
                  )}

                  <Icon size={18} weight={isActive ? "fill" : "regular"} />
                  <span className="text-[9px] mt-1 font-semibold leading-none">
                    {section.label.split(" ")[0]}
                  </span>

                  {/* Dot if active route but different section selected */}
                  {hasCurrentRoute && !isActive && (
                    <div
                      className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
                      style={{ background: section.color ?? "var(--accent)" }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer controls */}
          <div className="flex flex-col items-center gap-2 pb-2 pt-2 w-full border-t px-2" style={{ borderColor: "var(--border)" }}>
            <button
              onClick={toggleCollapsed}
              title={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
              className="p-2 rounded-md transition-colors hover:bg-[var(--bg-subtle)] w-full flex justify-center"
              style={{ color: "var(--text-muted)" }}
            >
              <SidebarSimple size={14} />
            </button>
            <ThemeToggle />
          </div>
        </div>

        {/* ── Item Panel (right) ── */}
        {!collapsed && (
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            {/* Header */}
            <div
              className="px-3 pt-4 pb-3 border-b sticky top-0 z-10"
              style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
            >
              {/* Brand name */}
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-bold text-[15px] leading-tight" style={{ color: "var(--text)" }}>AutoSpa</p>
                  <p className="text-[11px] leading-tight" style={{ color: "var(--text-muted)" }}>Marketing AI</p>
                </div>
                <UserMenu />
              </div>

              {/* Page selector */}
              {pages.length > 1 && (
                <select
                  value={selectedPageId}
                  onChange={(e) => setSelectedPageId(e.target.value)}
                  className="w-full text-xs rounded-md px-2.5 py-2 border truncate outline-none"
                  style={{ borderColor: "var(--border)", background: "var(--bg-subtle)", color: "var(--text)" }}
                >
                  {pages.map((p) => (
                    <option key={p.id} value={p.id}>{p.pageName}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Section label */}
            <div className="px-3 pt-3 pb-1.5">
              <p
                className="text-[11px] font-bold"
                style={{ color: activeSection.color ?? "var(--text-muted)" }}
              >
                {activeSection.label}
              </p>
            </div>

            {/* Nav items */}
            <nav className="flex-1 px-2 pb-2 overflow-y-auto">
              <div className="space-y-1">
                {visibleItems.map((item) => {
                  const active = item.href === "/"
                    ? pathname === "/"
                    : pathname === item.href || pathname.startsWith(item.href + "/");
                  return <NavLink key={item.href} item={item} active={active} />;
                })}
              </div>

              {/* Expert unlock hint */}
              {mode === "simple" && hiddenCount > 0 && (
                <button
                  onClick={toggleMode}
                  className="mt-3 w-full text-left px-2.5 py-2 rounded-md text-xs font-medium transition-colors hover:bg-[var(--bg-subtle)]"
                  style={{ color: "var(--text-muted)", border: "1px dashed var(--border-strong)" }}
                >
                  Xem thêm {hiddenCount} tính năng nâng cao
                </button>
              )}
            </nav>

            {/* Footer: mode toggle + version */}
            <div
              className="px-3 py-2 border-t flex items-center justify-between"
              style={{ borderColor: "var(--border)" }}
            >
              <button
                onClick={toggleMode}
                className="text-[11px] px-2.5 py-1.5 rounded-md font-semibold transition-colors"
                style={{
                  background: mode === "advanced" ? "var(--premium-light)" : "var(--accent-light)",
                  color: mode === "advanced" ? "var(--premium)" : "var(--accent)",
                }}
              >
                {mode === "simple" ? "Đơn giản" : "Nâng cao"}
              </button>
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>v2.4.0</span>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
