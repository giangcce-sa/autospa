"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ChartBar, Eye, ThumbsUp, Users, Flame, Heart, ChatCircle, Sparkle } from "@phosphor-icons/react";
import { truncate } from "@/lib/utils";

interface ReportData {
  overview: { postCount: number; publishedCount: number; totalReach: number; totalLikes: number; totalComments: number; totalShares: number; avgEngagement: number };
  crm: { customers: number; leads: number; closedLeads: number; hotLeads: number; conversionRate: number; careMessages: number };
  topPosts: { id: string; caption: string; analytics: { likes: number; comments: number; shares: number; reach: number } | null }[];
  bySource: { source: string; _count: number }[];
  bySegment: { segment: string; _count: number }[];
}

const MetricCard = ({ label, value, sub, icon: Icon, color }: { label: string; value: string | number; sub?: string; icon: React.ElementType; color: string }) => (
  <Card>
    <div className="flex items-center justify-between mb-2">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: color + "18" }}>
        <Icon size={14} style={{ color }} weight="fill" />
      </div>
    </div>
    <p className="text-2xl font-bold" style={{ color: "var(--text)" }}>{value}</p>
    {sub && <p className="text-[10px]" style={{ color: "var(--accent)" }}>{sub}</p>}
    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{label}</p>
  </Card>
);

export function ReportsDashboard() {
  const [data, setData] = useState<ReportData | null>(null);
  const [summary, setSummary] = useState("");
  const [genLoading, setGenLoading] = useState(false);

  useEffect(() => {
    fetch("/api/reports").then((r) => r.json()).then((res) => res.data && setData(res.data));
  }, []);

  const generateSummary = async () => {
    setGenLoading(true);
    try {
      const res = await fetch("/api/reports", { method: "POST" });
      const d = await res.json();
      if (d.data) setSummary(d.data.summary);
    } finally { setGenLoading(false); }
  };

  if (!data) return <div className="text-center py-16" style={{ color: "var(--text-muted)" }}>Đang tải...</div>;

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Bài đã đăng" value={data.overview.publishedCount} sub={`/ ${data.overview.postCount} tổng`} icon={ChartBar} color="var(--accent)" />
        <MetricCard label="Tổng tiếp cận" value={data.overview.totalReach.toLocaleString("vi-VN")} icon={Eye} color="var(--blue)" />
        <MetricCard label="Tổng lượt thích" value={data.overview.totalLikes.toLocaleString("vi-VN")} icon={ThumbsUp} color="var(--rose)" />
        <MetricCard label="Tỷ lệ tương tác" value={`${data.overview.avgEngagement}%`} icon={Flame} color="var(--amber)" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Khách hàng CRM" value={data.crm.customers} icon={Users} color="var(--accent)" />
        <MetricCard label="Tổng leads" value={data.crm.leads} sub={`${data.crm.hotLeads} đang nóng`} icon={Flame} color="var(--rose)" />
        <MetricCard label="Đã chốt" value={data.crm.closedLeads} sub={`${data.crm.conversionRate}% tỷ lệ`} icon={ChartBar} color="var(--accent)" />
        <MetricCard label="Tin nhắn chăm sóc" value={data.crm.careMessages} icon={Heart} color="var(--rose)" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          <Card>
            <CardHeader><CardTitle>Top 5 bài đăng hiệu quả nhất</CardTitle></CardHeader>
            {data.topPosts.length === 0 ? (
              <p className="text-xs text-center py-6" style={{ color: "var(--text-muted)" }}>Chưa có dữ liệu analytics. Thêm số liệu ở trang Analytics.</p>
            ) : (
              <div className="space-y-2">
                {data.topPosts.map((post, i) => (
                  <div key={post.id} className="flex items-start gap-3 p-2.5 rounded-lg" style={{ background: "var(--bg-subtle)" }}>
                    <span className="text-sm font-bold shrink-0 w-5" style={{ color: i === 0 ? "var(--amber)" : "var(--text-muted)" }}>#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs" style={{ color: "var(--text)" }}>{truncate(post.caption, 70)}</p>
                      {post.analytics && (
                        <div className="flex gap-3 mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
                          <span>{post.analytics.reach.toLocaleString()} reach</span>
                          <span>{post.analytics.likes} likes</span>
                          <span>{post.analytics.comments} cmt</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkle size={14} style={{ color: "var(--accent)" }} weight="fill" />
                <CardTitle>Nhận xét AI</CardTitle>
              </div>
              <Button size="sm" variant="secondary" onClick={generateSummary} loading={genLoading}>Tạo nhận xét</Button>
            </CardHeader>
            {summary ? (
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{summary}</p>
            ) : (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Nhấn "Tạo nhận xét" để AI phân tích hiệu quả tổng thể và đề xuất cải thiện.</p>
            )}
          </Card>
        </div>

        <div className="space-y-3">
          <Card>
            <CardHeader><CardTitle>Nguồn Lead</CardTitle></CardHeader>
            {data.bySource.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Chưa có dữ liệu</p>
            ) : (
              <div className="space-y-2">
                {data.bySource.map((s) => {
                  const total = data.bySource.reduce((a, b) => a + b._count, 0);
                  const pct = total > 0 ? Math.round((s._count / total) * 100) : 0;
                  return (
                    <div key={s.source}>
                      <div className="flex justify-between text-xs mb-0.5" style={{ color: "var(--text-secondary)" }}>
                        <span>{s.source}</span><span>{s._count} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: "var(--bg-subtle)" }}>
                        <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: "var(--accent)" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader><CardTitle>Phân khúc KH</CardTitle></CardHeader>
            {data.bySegment.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Chưa có dữ liệu</p>
            ) : (
              <div className="space-y-2">
                {data.bySegment.map((s) => {
                  const total = data.bySegment.reduce((a, b) => a + b._count, 0);
                  const pct = total > 0 ? Math.round((s._count / total) * 100) : 0;
                  const colors: Record<string, string> = { vip: "var(--amber)", regular: "var(--accent)", new: "var(--blue)" };
                  return (
                    <div key={s.segment}>
                      <div className="flex justify-between text-xs mb-0.5" style={{ color: "var(--text-secondary)" }}>
                        <span>{s.segment === "vip" ? "VIP" : s.segment === "regular" ? "Thân thiết" : "Mới"}</span>
                        <span>{s._count} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: "var(--bg-subtle)" }}>
                        <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: colors[s.segment] || "var(--accent)" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
