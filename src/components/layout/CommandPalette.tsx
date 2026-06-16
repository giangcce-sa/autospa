"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  Gauge, PencilSimple, PaperPlaneTilt, Archive, Tag, Image, Stack,
  ChartBar, Eye, ChartLine, ChatCircleDots, UsersThree, Flame,
  Gear, Briefcase, Buildings, Palette, Brain, BookOpen, Scan,
  Robot, ChatsTeardrop, Lightning, ArrowsSplit, Megaphone, Sparkle,
  MagnifyingGlass, X, TrendUp,
} from "@phosphor-icons/react";

interface PaletteItem {
  id: string;
  label: string;
  group: string;
  href?: string;
  icon: React.ElementType;
  premium?: boolean;
  keywords?: string;
}

const ITEMS: PaletteItem[] = [
  // Core
  { id: "dashboard", label: "Dashboard — Trang chủ", group: "Trang", href: "/", icon: Gauge },
  { id: "orchestrator", label: "Orchestrator — AI Agent Hub", group: "AI Agents", href: "/orchestrator", icon: Robot, premium: true },
  { id: "council", label: "AI Council — Phiên tranh luận", group: "AI Agents", href: "/council", icon: ChatsTeardrop, premium: true },
  { id: "ceo-memory", label: "CEO Memory — Bộ nhớ quyết định", group: "AI Agents", href: "/ceo-memory", icon: Brain, premium: true },
  // Content
  { id: "content", label: "Viết bài — Content AI", group: "Nội dung", href: "/content", icon: PencilSimple, keywords: "tao bai dang content" },
  { id: "publish", label: "Đăng & Lịch — Schedule", group: "Nội dung", href: "/publish", icon: PaperPlaneTilt, keywords: "dang bai lich" },
  { id: "library", label: "Thư viện — Bài đã tạo", group: "Nội dung", href: "/library", icon: Archive },
  { id: "promotions", label: "Flash Deal — Khuyến mãi", group: "Nội dung", href: "/promotions", icon: Tag },
  { id: "images", label: "Tạo hình ảnh — Image AI", group: "Nội dung", href: "/images", icon: Image, keywords: "hinh anh anh" },
  { id: "bulk", label: "Tạo hàng loạt — Bulk create", group: "Nội dung", href: "/bulk", icon: Stack },
  { id: "content-research", label: "Nghiên cứu AI — Research", group: "Nội dung", href: "/content-research", icon: Sparkle },
  { id: "ab-test", label: "A/B Testing", group: "Nội dung", href: "/ab-test", icon: ArrowsSplit },
  // Ads & Analytics
  { id: "facebook-ads", label: "Facebook Ads", group: "Quảng cáo", href: "/facebook-ads", icon: Megaphone },
  { id: "analytics", label: "Phân tích — Analytics", group: "Quảng cáo", href: "/analytics", icon: ChartBar },
  { id: "reports", label: "Báo cáo — Reports", group: "Quảng cáo", href: "/reports", icon: ChartLine },
  { id: "listening", label: "Social Listening", group: "Quảng cáo", href: "/listening", icon: Eye },
  { id: "competitors", label: "Intelligence — Đối thủ", group: "Quảng cáo", href: "/competitors", icon: TrendUp },
  // Customers
  { id: "inbox", label: "Tin nhắn — Inbox", group: "Khách hàng", href: "/inbox", icon: ChatCircleDots, keywords: "tin nhan chat" },
  { id: "crm", label: "CRM — Quản lý khách", group: "Khách hàng", href: "/crm", icon: UsersThree },
  { id: "sale", label: "Chốt Sale — Leads", group: "Khách hàng", href: "/sale", icon: Flame, keywords: "lead sale" },
  { id: "zalo", label: "Zalo OA", group: "Khách hàng", href: "/zalo", icon: Lightning },
  // Settings
  { id: "settings", label: "Cài đặt — Settings", group: "Thiết lập", href: "/settings", icon: Gear, keywords: "api key cai dat" },
  { id: "services", label: "Dịch vụ — Services", group: "Thiết lập", href: "/services", icon: Briefcase },
  { id: "brand", label: "Thương hiệu — Brand", group: "Thiết lập", href: "/brand", icon: Buildings },
  { id: "brand-kit", label: "Brand Kit — Màu sắc logo", group: "Thiết lập", href: "/brand-kit", icon: Palette },
  { id: "style-training", label: "Style Training — Văn phong AI", group: "Thiết lập", href: "/style-training", icon: Brain },
  { id: "stories", label: "Câu chuyện thực tế", group: "Thiết lập", href: "/stories", icon: BookOpen },
  { id: "skin-ai", label: "AI Da liễu — Skin AI", group: "Thiết lập", href: "/skin-ai", icon: Scan },
  { id: "automation", label: "Tự động hóa — Workflows", group: "Thiết lập", href: "/automation", icon: Lightning },
];

const GROUPS = ["AI Agents", "Trang", "Nội dung", "Quảng cáo", "Khách hàng", "Thiết lập"];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const router = useRouter();

  const onSelect = useCallback((item: PaletteItem) => {
    if (item.href) {
      router.push(item.href);
      setOpen(false);
      setValue("");
    }
  }, [router]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  if (!open) return null;

  const filtered = value.trim()
    ? ITEMS.filter((item) => {
        const q = value.toLowerCase();
        return (
          item.label.toLowerCase().includes(q) ||
          item.group.toLowerCase().includes(q) ||
          (item.keywords ?? "").includes(q)
        );
      })
    : ITEMS;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div
          className="flex items-center gap-3 px-4 py-3 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <MagnifyingGlass size={15} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          <input
            autoFocus
            placeholder="Tìm trang, tính năng..."
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="flex-1 text-sm outline-none bg-transparent"
            style={{ color: "var(--text)" }}
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ background: "var(--bg-subtle)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto py-2">
          {value.trim() ? (
            <div className="px-2">
              {filtered.length === 0 ? (
                <p className="text-xs text-center py-6" style={{ color: "var(--text-muted)" }}>Không tìm thấy</p>
              ) : (
                filtered.map((item) => (
                  <PaletteRow key={item.id} item={item} onSelect={() => onSelect(item)} />
                ))
              )}
            </div>
          ) : (
            GROUPS.map((group) => {
              const groupItems = filtered.filter((i) => i.group === group);
              if (!groupItems.length) return null;
              return (
                <div key={group} className="mb-1">
                  <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                    {group}
                  </p>
                  <div className="px-2">
                    {groupItems.map((item) => (
                      <PaletteRow key={item.id} item={item} onSelect={() => onSelect(item)} />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div
          className="px-4 py-2 border-t flex items-center gap-4"
          style={{ borderColor: "var(--border)" }}
        >
          {[["↑↓", "điều hướng"], ["↵", "chọn"], ["Esc", "đóng"]].map(([key, label]) => (
            <span key={key} className="flex items-center gap-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
              <kbd className="px-1 py-0.5 rounded font-mono text-[9px]" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>{key}</kbd>
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function PaletteRow({ item, onSelect }: { item: PaletteItem; onSelect: () => void }) {
  const Icon = item.icon;
  return (
    <button
      onClick={onSelect}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors hover:bg-[var(--bg-subtle)] group"
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{
          background: item.premium ? "var(--premium-light)" : "var(--bg-subtle)",
        }}
      >
        <Icon
          size={13}
          weight="fill"
          style={{ color: item.premium ? "var(--premium)" : "var(--text-secondary)" }}
        />
      </div>
      <span className="text-sm flex-1 truncate" style={{ color: "var(--text)" }}>{item.label}</span>
      {item.premium && (
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: "var(--premium-light)", color: "var(--premium)" }}>
          AI
        </span>
      )}
    </button>
  );
}

export function CommandPaletteButton() {
  return (
    <button
      onClick={() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }));
      }}
      className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors hover:bg-[var(--bg-subtle)]"
      style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
    >
      <MagnifyingGlass size={12} />
      Tìm kiếm
      <kbd className="flex items-center gap-0.5 font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
        <span>⌘K</span>
      </kbd>
    </button>
  );
}
