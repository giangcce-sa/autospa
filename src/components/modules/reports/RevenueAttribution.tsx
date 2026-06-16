"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { CurrencyCircleDollar, Trophy, Megaphone, Article, WarningCircle } from "@phosphor-icons/react";
import { truncate } from "@/lib/utils";

interface PostAttribution {
  postId: string;
  caption: string;
  platform?: string;
  publishedAt?: string;
  bookings: number;
  leads: number;
  revenue: number;
}

interface CampaignAttribution {
  campaignId: string;
  campaignName: string;
  bookings: number;
  leads: number;
  revenue: number;
}

interface AttributionData {
  days: number;
  totalRevenue: number;
  totalBookings: number;
  unattributed: number;
  unattributedAmount: number;
  topPosts: PostAttribution[];
  topCampaigns: CampaignAttribution[];
}

function formatVnd(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(n) + "đ";
}

export function RevenueAttribution() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<AttributionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/attribution?days=${days}`)
      .then((r) => r.json())
      .then((res) => { if (res.success) setData(res.data); })
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}
        </div>
        <div className="skeleton h-48 rounded-xl" />
        <div className="skeleton h-48 rounded-xl" />
      </div>
    );
  }

  if (!data || (data.totalBookings === 0 && data.topPosts.length === 0)) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <CurrencyCircleDollar size={36} className="mb-3 opacity-20" style={{ color: "var(--text-secondary)" }} weight="fill" />
          <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>Chưa có dữ liệu doanh thu</p>
          <p className="text-xs mt-1 max-w-sm" style={{ color: "var(--text-muted)" }}>
            Khi spa software gửi webhook <code className="text-[10px] px-1 rounded" style={{ background: "var(--bg-subtle)" }}>payment_received</code> kèm <code className="text-[10px] px-1 rounded" style={{ background: "var(--bg-subtle)" }}>amount</code>,
            hệ thống sẽ tự động trace bài viết / quảng cáo nào tạo ra doanh thu.
          </p>
        </div>
      </Card>
    );
  }

  const attributedPct = data.totalRevenue > 0
    ? Math.round(((data.totalRevenue - data.unattributedAmount) / data.totalRevenue) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* Time range selector */}
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Trong <strong style={{ color: "var(--text)" }}>{data.days} ngày</strong> qua
        </p>
        <Select value={String(days)} onChange={(e) => setDays(Number(e.target.value))} className="w-32">
          <option value="7">7 ngày</option>
          <option value="30">30 ngày</option>
          <option value="90">90 ngày</option>
        </Select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-2" style={{ background: "var(--accent-light)" }}>
            <CurrencyCircleDollar size={14} style={{ color: "var(--accent)" }} weight="fill" />
          </div>
          <p className="text-xl font-bold" style={{ color: "var(--text)" }}>{formatVnd(data.totalRevenue)}</p>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Tổng doanh thu</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-2" style={{ background: "var(--blue-light)" }}>
            <Trophy size={14} style={{ color: "var(--blue)" }} weight="fill" />
          </div>
          <p className="text-xl font-bold" style={{ color: "var(--text)" }}>{data.totalBookings}</p>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Đơn đã thanh toán</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-2" style={{ background: "var(--accent-light)" }}>
            <Article size={14} style={{ color: "var(--accent)" }} weight="fill" />
          </div>
          <p className="text-xl font-bold" style={{ color: "var(--text)" }}>{attributedPct}%</p>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Có nguồn truy được</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-2" style={{ background: "var(--amber-light)" }}>
            <WarningCircle size={14} style={{ color: "var(--amber)" }} weight="fill" />
          </div>
          <p className="text-xl font-bold" style={{ color: "var(--text)" }}>{data.unattributed}</p>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Chưa rõ nguồn</p>
        </div>
      </div>

      {/* Top posts */}
      <Card>
        <CardHeader>
          <CardTitle>Top 10 bài tạo doanh thu</CardTitle>
          <Article size={14} style={{ color: "var(--accent)" }} weight="fill" />
        </CardHeader>
        {data.topPosts.length === 0 ? (
          <p className="text-xs text-center py-6" style={{ color: "var(--text-muted)" }}>
            Chưa có lead nào được attribute về bài viết. Đảm bảo lead tạo từ FB Messenger có referral payload (m.me link có ?ref=post:[id])
          </p>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {data.topPosts.map((p, idx) => (
              <div key={p.postId} className="flex items-start gap-3 py-3">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                  style={{
                    background: idx < 3 ? "var(--accent)" : "var(--bg-subtle)",
                    color: idx < 3 ? "white" : "var(--text-muted)",
                  }}
                >
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-snug" style={{ color: "var(--text)" }}>{truncate(p.caption, 100)}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {p.platform ?? "facebook"} · {p.leads} lead · {p.bookings} đơn
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold" style={{ color: "var(--accent)" }}>{formatVnd(p.revenue)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Top campaigns */}
      {data.topCampaigns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top campaign quảng cáo ROAS</CardTitle>
            <Megaphone size={14} style={{ color: "var(--amber)" }} weight="fill" />
          </CardHeader>
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {data.topCampaigns.map((c, idx) => (
              <div key={c.campaignId} className="flex items-start gap-3 py-3">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                  style={{
                    background: idx === 0 ? "var(--amber)" : "var(--bg-subtle)",
                    color: idx === 0 ? "white" : "var(--text-muted)",
                  }}
                >
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{c.campaignName}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {c.leads} lead · {c.bookings} đơn
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold" style={{ color: "var(--amber)" }}>{formatVnd(c.revenue)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
