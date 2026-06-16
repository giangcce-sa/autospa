"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Gauge, Briefcase, PencilSimple, Image, PaperPlaneTilt,
  Archive, ChatCircleDots, Buildings, Brain, Gear, Sparkle,
  Stack, ChartBar, Palette, Lightning, ChatTeardropDots,
  UsersThree, Megaphone, Robot, ChartLine, Scan, Eye, Flame,
  Tag, ArrowsSplit, BookOpen, CaretRight, ChatsTeardrop, TrendUp,
  SidebarSimple, MagnifyingGlass,
} from "@phosphor-icons/react";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";
import { useActivePage } from "@/contexts/ActivePageContext";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  premium?: boolean;
}

interface NavGroup {
  id: string;
  label: string;
  dot?: string;
  defaultOpen: boolean;
  items: NavItem[];
}

const PINNED: NavItem[] = [
  { label: "Dashboard", href: "/", icon: Gauge },
  { label: "Orchestrator", href: "/orchestrator", icon: Robot, premium: true },
  { label: "AI Council", href: "/council", icon: ChatsTeardrop, premium: true },
  { label: "CEO Memory", href: "/ceo-memory", icon: Brain, premium: true },
];

const GROUPS: NavGroup[] = [
  {
    id: "content",
    label: "Nội dung",
    dot: "var(--accent)",
    defaultOpen: false,
    items: [
      { label: "Viết bài", href: "/content", icon: PencilSimple },
      { label: "Đăng & Lịch", href: "/publish", icon: PaperPlaneTilt },
      { label: "Thư viện", href: "/library", icon: Archive },
      { label: "Flash Deal", href: "/flash-deal", icon: Tag },
      { label: "Nghiên cứu", href: "/content-research", icon: Sparkle },
      { label: "Tạo ảnh AI", href: "/images", icon: Image },
      { label: "Hàng loạt", href: "/bulk", icon: Stack },
      { label: "A/B Test", href: "/ab-test", icon: ArrowsSplit },
    ],
  },
  {
    id: "ads",
    label: "Quảng cáo",
    dot: "var(--amber)",
    defaultOpen: false,
    items: [
      { label: "Facebook Ads", href: "/facebook-ads", icon: Megaphone },
      { label: "Phân tích", href: "/analytics", icon: ChartBar },
      { label: "Intelligence", href: "/competitors", icon: TrendUp },
      { label: "Listening", href: "/listening", icon: Eye },
      { label: "Báo cáo", href: "/reports", icon: ChartLine },
    ],
  },
  {
    id: "customers",
    label: "Khách hàng",
    dot: "var(--rose)",
    defaultOpen: false,
    items: [
      { label: "Tin nhắn", href: "/inbox", icon: ChatCircleDots },
      { label: "Chốt Sale", href: "/sale", icon: Flame },
      { label: "CRM", href: "/crm", icon: UsersThree },
      { label: "Zalo OA", href: "/zalo", icon: Lightning },
      { label: "Bình luận", href: "/auto-comment", icon: ChatTeardropDots },
    ],
  },
  {
    id: "settings",
    label: "Thiết lập",
    defaultOpen: false,
    items: [
      { label: "Cài đặt", href: "/settings", icon: Gear },
      { label: "Dịch vụ", href: "/services", icon: Briefcase },
      { label: "Thương hiệu", href: "/brand", icon: Buildings },
      { label: "Brand Kit", href: "/brand-kit", icon: Palette },
      { label: "Style Training", href: "/style-training", icon: Brain },
      { label: "Tự động hóa", href: "/automation", icon: Lightning },
      { label: "AI Da liễu", href: "/skin-ai", icon: Scan },
      { label: "Câu chuyện", href: "/stories", icon: BookOpen },
    ],
  },
];

const ICON_ONLY_KEY = "sidebar-icon-only";
const GROUP_COLLAPSE_KEY = "sidebar-collapsed";

function NavLink({
  item,
  active,
  iconOnly,
}: {
  item: NavItem;
  active: boolean;
  iconOnly: boolean;
}) {
  const Icon = item.icon;
  const isPremiumActive = item.premium && active;
  const isPremiumIdle = item.premium && !active;

  const activeStyle = isPremiumActive
    ? { background: "linear-gradient(135deg, var(--premium) 0%, var(--premium-hover) 100%)", color: "white", boxShadow: "var(--shadow-premium)" }
    : { background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%)", color: "white", boxShadow: "0 2px 10px rgba(45,106,79,0.28)" };

  const idleStyle = isPremiumIdle
    ? { background: "transparent", color: "var(--premium)" }
    : { background: "transparent", color: "var(--text-secondary)" };

  const className = `${item.premium ? "nav-item-premium" : "nav-item"} flex items-center gap-2.5 rounded-lg font-medium text-[13px] transition-all duration-150 ${iconOnly ? "justify-center px-0 py-2" : "px-2.5 py-[7px]"}`;

  return (
    <Link
      href={item.href}
      className={className}
      title={iconOnly ? item.label : undefined}
      style={active ? activeStyle : idleStyle}
    >
      <Icon size={14} weight={active ? "fill" : "regular"} style={{ flexShrink: 0 }} />
      {!iconOnly && (
        <>
          <span className="truncate flex-1">{item.label}</span>
          {item.badge && !active && (
            <span
              className="badge-pulse text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
              style={{ background: item.premium ? "var(--premium)" : "var(--accent)", color: "white" }}
            >
              {item.badge}
            </span>
          )}
        </>
      )}
    </Link>
  );
}

function CollapsibleGroup({
  group,
  pathname,
  open,
  onToggle,
  iconOnly,
}: {
  group: NavGroup;
  pathname: string;
  open: boolean;
  onToggle: () => void;
  iconOnly: boolean;
}) {
  const hasActive = group.items.some((i) => i.href === pathname);

  if (iconOnly) {
    return (
      <div className="space-y-0.5">
        {group.items.map((item) => (
          <NavLink key={item.href} item={item} active={pathname === item.href} iconOnly />
        ))}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={onToggle}
        className="group/hdr flex items-center justify-between w-full px-2 py-1.5 rounded-lg transition-colors hover:bg-[var(--bg-subtle)]"
      >
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: hasActive ? "var(--text-secondary)" : "var(--text-muted)" }}>
          {group.dot && (
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: hasActive ? group.dot : "var(--border-strong)" }}
            />
          )}
          {group.label}
        </span>
        <div className="flex items-center gap-1.5">
          {!open && hasActive && (
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: group.dot ?? "var(--accent)" }} />
          )}
        <CaretRight
          size={9}
          style={{
            color: "var(--text-muted)",
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.2s cubic-bezier(0.4,0,0.2,1)",
          }}
        />
        </div>
      </button>

      <div
        className="overflow-hidden"
        style={{
          maxHeight: open ? "600px" : "0px",
          opacity: open ? 1 : 0,
          transition: "max-height 0.28s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease",
        }}
      >
        <div className="space-y-0.5 pt-0.5 pb-1 pl-1">
          {group.items.map((item) => (
            <NavLink key={item.href} item={item} active={pathname === item.href} iconOnly={false} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { pages, selectedPageId, setSelectedPageId } = useActivePage();

  const [iconOnly, setIconOnly] = useState(false);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    const defaults: Record<string, boolean> = {};
    GROUPS.forEach((g) => { defaults[g.id] = !g.defaultOpen; });
    return defaults;
  });

  useEffect(() => {
    try {
      const io = localStorage.getItem(ICON_ONLY_KEY);
      if (io === "1") setIconOnly(true);
      const saved = JSON.parse(localStorage.getItem(GROUP_COLLAPSE_KEY) ?? "{}") as Record<string, boolean>;
      if (Object.keys(saved).length > 0) setCollapsed((prev) => ({ ...prev, ...saved }));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    GROUPS.forEach((g) => {
      if (g.items.some((i) => i.href === pathname)) {
        setCollapsed((prev) => {
          if (!prev[g.id]) return prev;
          const next = { ...prev, [g.id]: false };
          localStorage.setItem(GROUP_COLLAPSE_KEY, JSON.stringify(next));
          return next;
        });
      }
    });
  }, [pathname]);

  const toggleIconOnly = () => {
    setIconOnly((v) => {
      localStorage.setItem(ICON_ONLY_KEY, v ? "0" : "1");
      return !v;
    });
  };

  const toggleGroup = (id: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem(GROUP_COLLAPSE_KEY, JSON.stringify(next));
      return next;
    });
  };

  return (
    <>
      {/* Spacer for layout offset */}
      <div
        className="hidden md:block shrink-0 transition-all duration-200"
        style={{ width: iconOnly ? "var(--sidebar-width-collapsed)" : "var(--sidebar-width)" }}
      />

      <aside
        className="fixed left-0 top-0 h-full flex-col border-r z-30 hidden md:flex overflow-y-auto transition-all duration-200"
        style={{
          width: iconOnly ? "var(--sidebar-width-collapsed)" : "var(--sidebar-width)",
          background: "var(--bg-card)",
          borderColor: "var(--border)",
        }}
      >
        {/* Logo + toggle */}
        <div
          className="p-3 border-b sticky top-0 z-10 flex items-center"
          style={{
            borderColor: "var(--border)",
            background: "var(--bg-card)",
            justifyContent: iconOnly ? "center" : "space-between",
          }}
        >
          {!iconOnly && (
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="logo-icon w-8 h-8 rounded-lg flex items-center justify-center shrink-0 cursor-default"
                style={{
                  background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%)",
                  boxShadow: "0 2px 8px rgba(45,106,79,0.35)",
                }}
              >
                <Sparkle size={16} weight="fill" color="white" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm leading-tight truncate" style={{ color: "var(--text)" }}>AutoSpa</p>
                <p className="text-[10px] leading-tight" style={{ color: "var(--text-muted)" }}>Marketing AI</p>
              </div>
            </div>
          )}

          {iconOnly && (
            <div
              className="logo-icon w-8 h-8 rounded-lg flex items-center justify-center cursor-default"
              style={{
                background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%)",
                boxShadow: "0 2px 8px rgba(45,106,79,0.35)",
              }}
            >
              <Sparkle size={16} weight="fill" color="white" />
            </div>
          )}

          {!iconOnly && (
            <button
              onClick={toggleIconOnly}
              className="p-1.5 rounded-lg transition-opacity hover:opacity-80 shrink-0"
              title="Thu gọn sidebar (Cmd+B)"
              style={{ color: "var(--text-muted)" }}
            >
              <SidebarSimple size={14} />
            </button>
          )}
        </div>

        {/* Page selector */}
        {!iconOnly && pages.length > 1 && (
          <div className="px-3 pt-2">
            <select
              value={selectedPageId}
              onChange={(e) => setSelectedPageId(e.target.value)}
              className="w-full text-xs rounded-lg px-2.5 py-1.5 border truncate outline-none"
              style={{ borderColor: "var(--border)", background: "var(--bg-subtle)", color: "var(--text)" }}
            >
              {pages.map((p) => (
                <option key={p.id} value={p.id}>{p.pageName}</option>
              ))}
            </select>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-2 py-2 pb-4">
          {/* Pinned — AI Core */}
          {!iconOnly && (
            <p className="px-2 mb-1 text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
              AI Core
            </p>
          )}
          <div className="space-y-0.5 mb-3">
            {PINNED.map((item) => (
              <NavLink key={item.href} item={item} active={pathname === item.href} iconOnly={iconOnly} />
            ))}
          </div>

          {/* Divider */}
          <div className="mb-3" style={{ height: "1px", background: "var(--border)", margin: iconOnly ? "8px 4px" : "8px 8px" }} />

          {/* Groups */}
          <div className="space-y-1">
            {GROUPS.map((group) => (
              <CollapsibleGroup
                key={group.id}
                group={group}
                pathname={pathname}
                open={!collapsed[group.id]}
                onToggle={() => toggleGroup(group.id)}
                iconOnly={iconOnly}
              />
            ))}
          </div>
        </nav>

        {/* Footer */}
        <div
          className="p-3 border-t sticky bottom-0 flex items-center gap-2"
          style={{
            borderColor: "var(--border)",
            background: "var(--bg-card)",
            justifyContent: iconOnly ? "center" : "space-between",
            flexDirection: iconOnly ? "column" : "row",
          }}
        >
          {iconOnly ? (
            <>
              <button
                onClick={toggleIconOnly}
                className="p-1.5 rounded-lg transition-opacity hover:opacity-80"
                title="Mở rộng sidebar"
                style={{ color: "var(--text-muted)" }}
              >
                <SidebarSimple size={14} />
              </button>
              <ThemeToggle />
            </>
          ) : (
            <>
              <UserMenu />
              <div className="flex items-center gap-2">
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>v2.3.0</span>
                <ThemeToggle />
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
