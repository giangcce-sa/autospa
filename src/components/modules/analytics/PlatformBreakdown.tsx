"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { FacebookLogo, InstagramLogo, TrendUp } from "@phosphor-icons/react";

function TikTokIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.17 8.17 0 004.77 1.52V6.74a4.85 4.85 0 01-1-.05z"/>
    </svg>
  );
}

interface PlatformStat {
  platform: string;
  postCount: number;
  totalReach: number;
  totalEngagement: number;
  avgEngagement: number;
  topPost: { caption: string; engagement: number } | null;
}

const PLATFORM_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  facebook: { icon: FacebookLogo, color: "#1877F2", label: "Facebook" },
  instagram: { icon: InstagramLogo, color: "#E1306C", label: "Instagram" },
  tiktok: { icon: TikTokIcon, color: "#000", label: "TikTok" },
};

export function PlatformBreakdown() {
  const [stats, setStats] = useState<PlatformStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics?action=platform-breakdown")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setStats(json.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const maxEngagement = Math.max(...stats.map((s) => s.avgEngagement), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendUp size={14} weight="fill" style={{ color: "var(--accent)" }} />
          Hiệu suất theo nền tảng
        </CardTitle>
      </CardHeader>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
      ) : stats.length === 0 ? (
        <p className="text-xs text-center py-4" style={{ color: "var(--text-muted)" }}>
          Chưa có dữ liệu — kết nối Instagram/TikTok và đăng bài để xem so sánh
        </p>
      ) : (
        <div className="space-y-3">
          {stats.map((s) => {
            const meta = PLATFORM_META[s.platform] ?? PLATFORM_META.facebook;
            const Icon = meta.icon;
            const barPct = Math.round((s.avgEngagement / maxEngagement) * 100);
            return (
              <div key={s.platform} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon size={14} style={{ color: meta.color }} />
                    <span className="text-[12px] font-semibold" style={{ color: "var(--text)" }}>{meta.label}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}>
                      {s.postCount} bài
                    </span>
                  </div>
                  <div className="text-right text-[11px]">
                    <span className="font-semibold tabular-nums" style={{ color: "var(--text)" }}>
                      {Math.round(s.avgEngagement).toLocaleString()}
                    </span>
                    <span style={{ color: "var(--text-muted)" }}> avg eng</span>
                  </div>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-subtle)" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${barPct}%`, background: meta.color }}
                  />
                </div>
                <div className="flex justify-between text-[10px]" style={{ color: "var(--text-muted)" }}>
                  <span>Reach: {s.totalReach.toLocaleString()}</span>
                  <span>Tổng eng: {s.totalEngagement.toLocaleString()}</span>
                </div>
                {s.topPost && (
                  <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>
                    Top: "{s.topPost.caption.slice(0, 60)}…" ({s.topPost.engagement} eng)
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
