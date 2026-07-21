"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Gauge, PencilSimple, PaperPlaneTilt, Archive, Tag, Image, Stack,
  ChartBar, Eye, ChartLine, ChatCircleDots, UsersThree, Flame,
  Gear, Briefcase, Buildings, Palette, Brain, BookOpen, Scan,
  Robot, ChatsTeardrop, Lightning, ArrowsSplit, Megaphone, Sparkle,
  MagnifyingGlass, TrendUp,
  UserCircle, FilmSlate,
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
  { id: "dashboard", label: "Hôm nay", group: "Trang", href: "/", icon: Gauge, keywords: "dashboard trang chu" },
  { id: "brain", label: "Bộ não AutoSpa — Kỹ năng đã học", group: "Trí tuệ nhân tạo", href: "/brain", icon: Brain, premium: true, keywords: "bo nao brain skill ky nang hoc train" },
  { id: "orchestrator", label: "Trung tâm điều phối", group: "Trí tuệ nhân tạo", href: "/orchestrator", icon: Robot, premium: true, keywords: "orchestrator agent dieu phoi" },
  { id: "council", label: "Hội đồng tư vấn", group: "Trí tuệ nhân tạo", href: "/council", icon: ChatsTeardrop, premium: true, keywords: "ai council tranh luan" },
  { id: "ceo-memory", label: "Bộ nhớ quyết định", group: "Trí tuệ nhân tạo", href: "/ceo-memory", icon: Brain, premium: true, keywords: "ceo memory bo nho" },
  // Content
  { id: "content", label: "Viết bài", group: "Sáng tạo", href: "/content", icon: PencilSimple, keywords: "tao bai dang content ai" },
  { id: "video-studio", label: "Xưởng video", group: "Sáng tạo", href: "/video-studio", icon: FilmSlate, premium: true, keywords: "ai video studio runway elevenlabs sync lipsync" },
  { id: "publish", label: "Đăng bài và xếp lịch", group: "Sáng tạo", href: "/publish", icon: PaperPlaneTilt, keywords: "schedule dang bai lich" },
  { id: "library", label: "Thư viện nội dung", group: "Sáng tạo", href: "/library", icon: Archive },
  { id: "promotions", label: "Chương trình khuyến mãi", group: "Tăng trưởng", href: "/promotions", icon: Tag, keywords: "promo" },
  { id: "images", label: "Tạo hình ảnh", group: "Sáng tạo", href: "/images", icon: Image, keywords: "hinh anh image ai" },
  { id: "staff-visuals", label: "Hình ảnh nhân viên", group: "Sáng tạo", href: "/staff-visuals", icon: UserCircle, keywords: "visual library nhan vien anh mau khuon mat" },
  { id: "bulk", label: "Tạo nhiều nội dung", group: "Sáng tạo", href: "/bulk", icon: Stack, keywords: "bulk create hang loat" },
  { id: "content-research", label: "Nghiên cứu nội dung", group: "Sáng tạo", href: "/content-research", icon: Sparkle, keywords: "research ai" },
  { id: "ab-test", label: "So sánh hai phiên bản", group: "Sáng tạo", href: "/ab-test", icon: ArrowsSplit, keywords: "ab test testing" },
  // Ads & Analytics
  { id: "facebook-ads", label: "Quảng cáo Facebook", group: "Tăng trưởng", href: "/facebook-ads", icon: Megaphone },
  { id: "analytics", label: "Phân tích hiệu quả", group: "Tăng trưởng", href: "/analytics", icon: ChartBar, keywords: "analytics" },
  { id: "reports", label: "Báo cáo", group: "Tăng trưởng", href: "/reports", icon: ChartLine, keywords: "reports" },
  { id: "listening", label: "Lắng nghe mạng xã hội", group: "Tăng trưởng", href: "/listening", icon: Eye, keywords: "social listening" },
  { id: "competitors", label: "Theo dõi đối thủ", group: "Tăng trưởng", href: "/competitors", icon: TrendUp, keywords: "intelligence" },
  // Customers
  { id: "inbox", label: "Hộp thư", group: "Khách hàng", href: "/inbox", icon: ChatCircleDots, keywords: "inbox tin nhan chat" },
  { id: "crm", label: "Hồ sơ khách hàng", group: "Khách hàng", href: "/crm", icon: UsersThree, keywords: "crm" },
  { id: "sale", label: "Khách cần tư vấn", group: "Khách hàng", href: "/sale", icon: Flame, keywords: "lead sale chot" },
  { id: "zalo", label: "Zalo OA", group: "Khách hàng", href: "/zalo", icon: Lightning },
  // Settings
  { id: "settings", label: "Cài đặt", group: "Hệ thống", href: "/settings", icon: Gear, keywords: "settings api key cai dat" },
  { id: "services", label: "Danh mục dịch vụ", group: "Hệ thống", href: "/services", icon: Briefcase, keywords: "services" },
  { id: "brand", label: "Thông tin thương hiệu", group: "Hệ thống", href: "/brand", icon: Buildings, keywords: "brand" },
  { id: "brand-kit", label: "Bộ nhận diện", group: "Hệ thống", href: "/brand-kit", icon: Palette, keywords: "brand kit mau sac logo" },
  { id: "style-training", label: "Huấn luyện văn phong", group: "Hệ thống", href: "/style-training", icon: Brain, keywords: "style training ai" },
  { id: "stories", label: "Câu chuyện thực tế", group: "Hệ thống", href: "/stories", icon: BookOpen },
  { id: "skin-ai", label: "Phân tích da", group: "Hệ thống", href: "/skin-ai", icon: Scan, keywords: "ai da lieu skin" },
  { id: "automation", label: "Tự động hóa", group: "Hệ thống", href: "/automation", icon: Lightning, keywords: "workflows" },
];

const GROUPS = ["Trang", "Sáng tạo", "Khách hàng", "Tăng trưởng", "Trí tuệ nhân tạo", "Hệ thống"];

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
      style={{ background: "rgba(19,24,20,0.42)", backdropFilter: "blur(6px)" }}
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg rounded-lg overflow-hidden"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)" }}
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
                  <p className="px-4 py-1 text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
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
      className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors hover:bg-[var(--bg-subtle)] group"
    >
      <div
        className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
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
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0" style={{ background: "var(--premium-light)", color: "var(--premium)" }}>
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
      className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-colors hover:bg-[var(--bg-subtle)]"
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
