"use client";

import { useEffect, useState } from "react";
import { ChartBar, ChatCircle, Eye, Plus, Share, ThumbsUp, Trophy } from "@phosphor-icons/react";
import { DashboardMetric, DashboardPanel } from "@/components/dashboard/Dashboard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Surface, SurfaceHeader, SurfaceTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { SkeletonCard, SkeletonStat } from "@/components/ui/Skeleton";
import { truncate } from "@/lib/utils";
import { EngagementTrend } from "./EngagementTrend";
import { PlatformBreakdown } from "./PlatformBreakdown";

interface Post {
  id: string;
  caption: string;
  publishedAt: string | null;
  analytics: { reach: number; likes: number; comments: number; shares: number } | null;
}

interface Stats {
  totalReach: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  avgEngagement: number;
  topPosts: Post[];
  posts: Post[];
}

export function AnalyticsDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [manualForm, setManualForm] = useState({ postId: "", reach: "", likes: "", comments: "", shares: "" });
  const [saving, setSaving] = useState(false);
  const [showManual, setShowManual] = useState(false);

  const load = () => fetch("/api/analytics").then((response) => response.json()).then((result) => result.data && setStats(result.data));

  useEffect(() => {
    void load();
  }, []);

  const handleManualSave = async () => {
    if (!manualForm.postId) return;
    setSaving(true);
    try {
      await fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: manualForm.postId,
          reach: +manualForm.reach,
          likes: +manualForm.likes,
          comments: +manualForm.comments,
          shares: +manualForm.shares,
        }),
      });
      setManualForm({ postId: "", reach: "", likes: "", comments: "", shares: "" });
      setShowManual(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  if (!stats) {
    return (
      <div className="max-w-6xl space-y-4" role="status" aria-busy="true" aria-label="Đang tải Analytics">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => <SkeletonStat key={index} />)}
        </div>
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const measuredPosts = stats.posts.filter((post) => post.analytics);

  return (
    <div className="max-w-6xl space-y-5">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <DashboardMetric label="Tổng tiếp cận" value={stats.totalReach} detail="Số liệu đã lưu" icon={Eye} tone="info" />
        <DashboardMetric label="Tổng lượt thích" value={stats.totalLikes} detail="Số liệu đã lưu" icon={ThumbsUp} />
        <DashboardMetric label="Bình luận" value={stats.totalComments} detail="Số liệu đã lưu" icon={ChatCircle} tone="warning" />
        <DashboardMetric label="Lượt chia sẻ" value={stats.totalShares} detail="Số liệu đã lưu" icon={Share} tone="success" />
        <DashboardMetric label="Tỷ lệ tương tác" value={`${stats.avgEngagement}%`} detail="Từ analytics đã lưu" icon={ChartBar} />
      </section>

      <DashboardPanel title="Xu hướng tương tác 30 ngày" description="Chỉ tổng hợp các số liệu analytics đã lưu theo ngày.">
        <EngagementTrend />
      </DashboardPanel>

      <PlatformBreakdown />

      <div className="grid gap-4 lg:grid-cols-2">
        <DashboardPanel title="Bài đăng hiệu quả nhất" description="Xếp hạng từ số liệu analytics đã lưu.">
          {stats.topPosts.length === 0 ? (
            <EmptyState density="compact" icon={<Trophy size={20} aria-hidden="true" />} title="Chưa có dữ liệu analytics" description="Thêm số liệu thủ công để bắt đầu so sánh bài đăng." />
          ) : (
            <div className="space-y-2">
              {stats.topPosts.map((post, index) => (
                <div key={post.id} className="flex items-start gap-3 rounded-lg bg-[var(--bg-subtle)] p-3">
                  <span className={`shrink-0 text-sm font-bold ${index === 0 ? "text-[var(--amber)]" : "text-[var(--text-muted)]"}`}>#{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs leading-5">{truncate(post.caption, 70)}</p>
                    {post.analytics ? (
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[var(--text-muted)]">
                        <span>{post.analytics.likes} likes</span>
                        <span>{post.analytics.comments} bình luận</span>
                        <span>{post.analytics.shares} chia sẻ</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DashboardPanel>

        <Surface as="section">
          <SurfaceHeader className="flex-wrap">
            <div>
              <SurfaceTitle>Nhập số liệu thủ công</SurfaceTitle>
              <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">Gắn số liệu đã biết vào Post ID đã lưu trong Thư viện.</p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => setShowManual((current) => !current)} aria-expanded={showManual}>
              <Plus size={13} aria-hidden="true" /> {showManual ? "Đóng" : "Thêm"}
            </Button>
          </SurfaceHeader>
          {showManual ? (
            <div className="mt-4 space-y-3 border-b border-[var(--border)] pb-4">
              <Input label="Post ID" placeholder="ID bài viết" value={manualForm.postId} onChange={(event) => setManualForm({ ...manualForm, postId: event.target.value })} hint="Lấy từ trang Thư viện" />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Tiếp cận" type="number" placeholder="0" value={manualForm.reach} onChange={(event) => setManualForm({ ...manualForm, reach: event.target.value })} />
                <Input label="Like" type="number" placeholder="0" value={manualForm.likes} onChange={(event) => setManualForm({ ...manualForm, likes: event.target.value })} />
                <Input label="Comment" type="number" placeholder="0" value={manualForm.comments} onChange={(event) => setManualForm({ ...manualForm, comments: event.target.value })} />
                <Input label="Share" type="number" placeholder="0" value={manualForm.shares} onChange={(event) => setManualForm({ ...manualForm, shares: event.target.value })} />
              </div>
              <Button onClick={handleManualSave} loading={saving} fullWidth>Lưu số liệu</Button>
            </div>
          ) : null}
          {measuredPosts.length ? (
            <div className="mt-4 max-h-64 divide-y divide-[var(--border)] overflow-y-auto">
              {measuredPosts.map((post) => (
                <div key={post.id} className="flex items-center gap-2 py-2.5">
                  <p className="min-w-0 flex-1 truncate text-xs text-[var(--text-secondary)]">{truncate(post.caption, 40)}</p>
                  <div className="flex shrink-0 gap-2 text-[10px] text-[var(--text-muted)]">
                    <span>{post.analytics!.likes}L</span>
                    <span>{post.analytics!.comments}C</span>
                    <span>{post.analytics!.shares}S</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState density="compact" title="Chưa có bài đăng kèm analytics" />
          )}
        </Surface>
      </div>

      <DashboardPanel title={`Tất cả bài đã đăng (${stats.posts.length})`} description="Dấu “—” nghĩa là bài đăng chưa có analytics được lưu.">
        <div className="overflow-x-auto">
          <table className="min-w-[720px] w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {["Nội dung", "Tiếp cận", "Like", "Comment", "Share", "Tương tác"].map((heading) => (
                  <th key={heading} className="pb-2 pr-4 text-left font-medium text-[var(--text-secondary)]">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.posts.map((post) => (
                <tr key={post.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="max-w-[200px] py-3 pr-4"><p className="truncate">{post.caption}</p></td>
                  <td className="py-3 pr-4 text-[var(--text-secondary)]">{post.analytics?.reach.toLocaleString("vi-VN") ?? "—"}</td>
                  <td className="py-3 pr-4 text-[var(--text-secondary)]">{post.analytics?.likes ?? "—"}</td>
                  <td className="py-3 pr-4 text-[var(--text-secondary)]">{post.analytics?.comments ?? "—"}</td>
                  <td className="py-3 pr-4 text-[var(--text-secondary)]">{post.analytics?.shares ?? "—"}</td>
                  <td className="py-3">
                    {post.analytics ? (
                      <Badge variant={post.analytics.likes > 10 ? "success" : "neutral"}>
                        {Math.round(((post.analytics.likes + post.analytics.comments + post.analytics.shares) / Math.max(post.analytics.reach, 1)) * 100)}%
                      </Badge>
                    ) : <Badge variant="neutral">Chưa có</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DashboardPanel>
    </div>
  );
}
