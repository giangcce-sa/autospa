"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { PencilSimple, PaperPlaneTilt, CalendarBlank, ChatCircleDots, Briefcase, Sparkle, Users, Flame, Heart, Bell } from "@phosphor-icons/react";
import { formatDateTime, truncate } from "@/lib/utils";
import Link from "next/link";

interface Stats {
  totalPosts: number;
  publishedThisMonth: number;
  scheduled: number;
  pendingAppointments: number;
  unreadMessages: number;
  services: number;
  totalCustomers: number;
  hotLeads: number;
  pendingCare: number;
  unreadAlerts: number;
}

interface Post { id: string; caption: string; status: string; createdAt: string; service: { name: string } | null; }

export function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentPosts, setRecentPosts] = useState<Post[]>([]);

  useEffect(() => {
    fetch("/api/dashboard").then((r) => r.json()).then((res) => {
      if (res.data) { setStats(res.data); setRecentPosts(res.data.recentPosts ?? []); }
    });
  }, []);

  const contentCards = [
    { label: "Tổng bài viết", value: stats?.totalPosts ?? "-", icon: PencilSimple, href: "/library", color: "var(--accent)" },
    { label: "Đăng tháng này", value: stats?.publishedThisMonth ?? "-", icon: PaperPlaneTilt, href: "/library", color: "var(--blue)" },
    { label: "Đang lên lịch", value: stats?.scheduled ?? "-", icon: CalendarBlank, href: "/library", color: "var(--amber)" },
    { label: "Inbox chưa đọc", value: stats?.unreadMessages ?? "-", icon: ChatCircleDots, href: "/inbox", color: "var(--rose)" },
    { label: "Dịch vụ hoạt động", value: stats?.services ?? "-", icon: Briefcase, href: "/services", color: "var(--accent)" },
  ];

  const crmCards = [
    { label: "Khách hàng CRM", value: stats?.totalCustomers ?? "-", icon: Users, href: "/crm", color: "var(--accent)" },
    { label: "Leads nóng", value: stats?.hotLeads ?? "-", icon: Flame, href: "/sale", color: "var(--rose)" },
    { label: "Tin nhắn chờ gửi", value: stats?.pendingCare ?? "-", icon: Heart, href: "/care", color: "var(--amber)" },
    { label: "Cảnh báo chưa đọc", value: stats?.unreadAlerts ?? "-", icon: Bell, href: "/listening", color: "var(--blue)" },
    { label: "Yêu cầu đặt lịch", value: stats?.pendingAppointments ?? "-", icon: ChatCircleDots, href: "/inbox", color: "var(--rose)" },
  ];

  return (
    <div className="space-y-5">
      <div className="p-5 rounded-xl" style={{ background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%)" }}>
        <div className="flex items-center gap-2 mb-1">
          <Sparkle size={18} weight="fill" color="rgba(255,255,255,0.9)" />
          <p className="font-semibold text-base" style={{ color: "white" }}>AutoSpa Marketing Tool</p>
        </div>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>
          Tạo content, đăng bài, quản lý khách hàng và chăm sóc tự động — tất cả trong một nơi.
        </p>
      </div>

      <div>
        <p className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Nội dung & Đăng bài</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {contentCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link key={card.label} href={card.href}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: card.color + "18" }}>
                      <Icon size={15} style={{ color: card.color }} weight="fill" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold" style={{ color: "var(--text)" }}>{card.value}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{card.label}</p>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>CRM & Khách hàng</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {crmCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link key={card.label} href={card.href}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: card.color + "18" }}>
                      <Icon size={15} style={{ color: card.color }} weight="fill" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold" style={{ color: "var(--text)" }}>{card.value}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{card.label}</p>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Bài viết gần đây</CardTitle>
            <Link href="/library" className="text-xs" style={{ color: "var(--accent)" }}>Xem tất cả</Link>
          </CardHeader>
          {recentPosts.length === 0 ? (
            <p className="text-xs text-center py-8" style={{ color: "var(--text-muted)" }}>Chưa có bài viết nào</p>
          ) : (
            <div className="space-y-2">
              {recentPosts.map((post) => (
                <div key={post.id} className="flex items-start gap-3 py-2 border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs" style={{ color: "var(--text)" }}>{truncate(post.caption, 80)}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{formatDateTime(post.createdAt)}</p>
                  </div>
                  <StatusBadge status={post.status} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader><CardTitle>Bắt đầu nhanh</CardTitle></CardHeader>
          <div className="space-y-2">
            {[
              { href: "/settings", label: "1. Cấu hình API Keys", desc: "Nhập Claude, DALL-E, Facebook key" },
              { href: "/brand", label: "2. Thêm thông tin thương hiệu", desc: "Giới thiệu spa, FAQ, chính sách" },
              { href: "/services", label: "3. Thêm dịch vụ", desc: "Tên, giá, mô tả dịch vụ" },
              { href: "/style-training", label: "4. Huấn luyện văn phong", desc: "Upload bài mẫu để AI học" },
              { href: "/brand-kit", label: "5. Thiết lập Brand Kit", desc: "Logo, màu sắc thương hiệu" },
              { href: "/content", label: "6. Tạo nội dung đầu tiên", desc: "AI sinh caption + hashtag" },
            ].map((item) => (
              <Link key={item.href} href={item.href} className="flex items-center gap-3 p-2.5 rounded-lg hover:opacity-80 transition-opacity" style={{ background: "var(--bg-subtle)" }}>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium" style={{ color: "var(--text)" }}>{item.label}</p>
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{item.desc}</p>
                </div>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>→</span>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
