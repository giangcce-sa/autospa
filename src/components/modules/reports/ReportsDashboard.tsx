"use client";

import { useEffect, useState } from "react";
import { ChartBar, Eye, Flame, Heart, Sparkle, ThumbsUp, Users } from "@phosphor-icons/react";
import { DashboardMetric, DashboardPanel } from "@/components/dashboard/Dashboard";
import { Button } from "@/components/ui/Button";
import { EmptyState, UnavailableState } from "@/components/ui/EmptyState";
import { SkeletonCard, SkeletonStat } from "@/components/ui/Skeleton";
import { truncate } from "@/lib/utils";

interface ReportData {
  overview: {
    postCount: number;
    publishedCount: number;
    totalReach: number | null;
    totalLikes: number | null;
    totalComments: number | null;
    totalShares: number | null;
    avgEngagement: number | null;
  };
  crm: { customers: number; leads: number; closedLeads: number; hotLeads: number; conversionRate: number; careMessages: number } | null;
  topPosts: { id: string; caption: string; analytics: { likes: number; comments: number; shares: number; reach: number } | null }[];
  bySource: { source: string; _count: number }[];
  bySegment: { segment: string; _count: number }[];
}

export function ReportsDashboard() {
  const [data, setData] = useState<ReportData | null>(null);
  const [summary, setSummary] = useState("");
  const [genLoading, setGenLoading] = useState(false);

  useEffect(() => {
    fetch("/api/reports").then((response) => response.json()).then((result) => result.data && setData(result.data));
  }, []);

  const generateSummary = async () => {
    setGenLoading(true);
    try {
      const response = await fetch("/api/reports", { method: "POST" });
      const result = await response.json();
      if (result.data) setSummary(result.data.summary);
    } finally {
      setGenLoading(false);
    }
  };

  if (!data) {
    return (
      <div className="max-w-6xl space-y-4" role="status" aria-busy="true" aria-label="Đang tải báo cáo">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => <SkeletonStat key={index} />)}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => <SkeletonStat key={index} />)}
        </div>
        <SkeletonCard />
      </div>
    );
  }

  const sourceTotal = data.bySource.reduce((total, entry) => total + entry._count, 0);
  const segmentTotal = data.bySegment.reduce((total, entry) => total + entry._count, 0);

  return (
    <div className="max-w-6xl space-y-5">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <DashboardMetric label="Bài đã đăng" value={data.overview.publishedCount} detail={`${data.overview.postCount} bài tổng cộng`} icon={ChartBar} />
        <DashboardMetric label="Tổng tiếp cận" value={data.overview.totalReach?.toLocaleString("vi-VN") ?? "Chưa đo"} detail="Analytics đã lưu" icon={Eye} tone="info" unavailable={data.overview.totalReach == null} />
        <DashboardMetric label="Tổng lượt thích" value={data.overview.totalLikes?.toLocaleString("vi-VN") ?? "Chưa đo"} detail="Analytics đã lưu" icon={ThumbsUp} tone="success" unavailable={data.overview.totalLikes == null} />
        <DashboardMetric label="Tỷ lệ tương tác" value={data.overview.avgEngagement == null ? "Chưa đo" : `${data.overview.avgEngagement}%`} detail="Analytics đã lưu" icon={Flame} tone="warning" unavailable={data.overview.avgEngagement == null} />
      </section>

      {data.crm ? (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <DashboardMetric label="Khách hàng CRM" value={data.crm.customers} detail="Phạm vi tài khoản" icon={Users} />
          <DashboardMetric label="Tổng leads" value={data.crm.leads} detail={`${data.crm.hotLeads} lead đang nóng`} icon={Flame} tone="danger" />
          <DashboardMetric label="Đã chốt" value={data.crm.closedLeads} detail={`${data.crm.conversionRate}% tỷ lệ`} icon={ChartBar} tone="success" />
          <DashboardMetric label="Tin nhắn chăm sóc" value={data.crm.careMessages} detail="Bản ghi đã lưu" icon={Heart} tone="info" />
        </section>
      ) : (
        <UnavailableState
          density="compact"
          title="Báo cáo CRM theo Page chưa khả dụng"
          description="CRM, lead và care chưa có Page ownership tương thích nên không được ghép vào báo cáo theo Page."
        />
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(16rem,0.75fr)]">
        <div className="space-y-4">
          <DashboardPanel title="Top 5 bài đăng hiệu quả nhất" description="Xếp hạng từ analytics đã lưu, không suy diễn dữ liệu còn thiếu.">
            {data.topPosts.length === 0 ? (
              <EmptyState density="compact" title="Chưa có dữ liệu analytics" description="Thêm số liệu ở trang Analytics để bắt đầu so sánh bài đăng." />
            ) : (
              <div className="space-y-2">
                {data.topPosts.map((post, index) => (
                  <div key={post.id} className="flex items-start gap-3 rounded-lg bg-[var(--bg-subtle)] p-3">
                    <span className={`w-5 shrink-0 text-sm font-bold ${index === 0 ? "text-[var(--amber)]" : "text-[var(--text-muted)]"}`}>#{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs leading-5">{truncate(post.caption, 70)}</p>
                      {post.analytics ? (
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[var(--text-muted)]">
                          <span>{post.analytics.reach.toLocaleString("vi-VN")} reach</span>
                          <span>{post.analytics.likes} likes</span>
                          <span>{post.analytics.comments} bình luận</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DashboardPanel>

          <DashboardPanel title="Nhận xét AI" description="Phân tích được tạo theo yêu cầu từ dữ liệu báo cáo hiện tại.">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                {summary ? (
                  <p className="text-xs leading-6 text-[var(--text-secondary)]">{summary}</p>
                ) : (
                  <p className="text-xs leading-5 text-[var(--text-muted)]">Chưa tạo nhận xét cho dữ liệu hiện tại.</p>
                )}
              </div>
              <Button size="sm" variant={summary ? "secondary" : "primary"} onClick={generateSummary} loading={genLoading} className="shrink-0">
                <Sparkle size={14} aria-hidden="true" /> {summary ? "Tạo lại" : "Tạo nhận xét"}
              </Button>
            </div>
          </DashboardPanel>
        </div>

        <div className="space-y-4">
          <BreakdownPanel title="Nguồn Lead" entries={data.bySource} total={sourceTotal} labelFor={(value) => value} />
          <BreakdownPanel
            title="Phân khúc KH"
            entries={data.bySegment}
            total={segmentTotal}
            labelFor={(value) => value === "vip" ? "VIP" : value === "regular" ? "Thân thiết" : "Mới"}
          />
        </div>
      </div>
    </div>
  );
}

function BreakdownPanel({
  title,
  entries,
  total,
  labelFor,
}: {
  title: string;
  entries: { source?: string; segment?: string; _count: number }[];
  total: number;
  labelFor: (value: string) => string;
}) {
  return (
    <DashboardPanel title={title} description={`${total} bản ghi đã phân loại`}>
      {entries.length === 0 ? (
        <EmptyState density="compact" title="Chưa có dữ liệu" />
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => {
            const value = entry.source ?? entry.segment ?? "unknown";
            const percentage = total > 0 ? Math.round((entry._count / total) * 100) : 0;
            return (
              <div key={value}>
                <div className="mb-1 flex justify-between gap-3 text-xs text-[var(--text-secondary)]">
                  <span>{labelFor(value)}</span>
                  <span className="shrink-0 tabular-nums">{entry._count} ({percentage}%)</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                  <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${percentage}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardPanel>
  );
}
