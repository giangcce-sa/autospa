"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { ChartBar, Eye, ThumbsUp, ChatCircle, Share, Plus, Trophy, TrendUp, UsersThree } from "@phosphor-icons/react";
import { truncate } from "@/lib/utils";
import { EngagementTrend } from "./EngagementTrend";
import { LeadConversionChart } from "./LeadConversionChart";

interface Post { id: string; caption: string; publishedAt: string | null; analytics: { reach: number; likes: number; comments: number; shares: number } | null; }
interface Stats { totalReach: number; totalLikes: number; totalComments: number; totalShares: number; avgEngagement: number; topPosts: Post[]; posts: Post[]; }

const StatCard = ({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ElementType; color: string }) => (
  <Card>
    <div className="flex items-center justify-between mb-2">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: color + "18" }}>
        <Icon size={15} style={{ color }} weight="fill" />
      </div>
    </div>
    <p className="text-2xl font-bold" style={{ color: "var(--text)" }}>{value.toLocaleString("vi-VN")}</p>
    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{label}</p>
  </Card>
);

export function AnalyticsDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [manualForm, setManualForm] = useState({ postId: "", reach: "", likes: "", comments: "", shares: "" });
  const [saving, setSaving] = useState(false);
  const [showManual, setShowManual] = useState(false);

  const load = () => fetch("/api/analytics").then((r) => r.json()).then((res) => res.data && setStats(res.data));
  useEffect(() => { load(); }, []);

  const handleManualSave = async () => {
    if (!manualForm.postId) return;
    setSaving(true);
    try {
      await fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: manualForm.postId, reach: +manualForm.reach, likes: +manualForm.likes, comments: +manualForm.comments, shares: +manualForm.shares }),
      });
      setManualForm({ postId: "", reach: "", likes: "", comments: "", shares: "" });
      setShowManual(false);
      load();
    } finally { setSaving(false); }
  };

  if (!stats) return (
    <div className="space-y-4 max-w-5xl">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[1,2,3,4,5].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}
      </div>
      <div className="skeleton h-40 rounded-xl" />
      <div className="skeleton h-64 rounded-xl" />
    </div>
  );

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="Tổng tiếp cận" value={stats.totalReach} icon={Eye} color="var(--blue)" />
        <StatCard label="Tổng lượt thích" value={stats.totalLikes} icon={ThumbsUp} color="var(--accent)" />
        <StatCard label="Bình luận" value={stats.totalComments} icon={ChatCircle} color="var(--amber)" />
        <StatCard label="Lượt chia sẻ" value={stats.totalShares} icon={Share} color="var(--rose)" />
        <Card>
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--accent-light)" }}>
              <ChartBar size={15} style={{ color: "var(--accent)" }} weight="fill" />
            </div>
          </div>
          <p className="text-2xl font-bold" style={{ color: "var(--text)" }}>{stats.avgEngagement}%</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Tỷ lệ tương tác</p>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendUp size={14} style={{ color: "var(--accent)" }} weight="fill" />
              <CardTitle>Xu hướng tương tác 30 ngày</CardTitle>
            </div>
          </CardHeader>
          <EngagementTrend />
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <UsersThree size={14} style={{ color: "var(--blue)" }} weight="fill" />
              <CardTitle>Chuyển đổi Lead</CardTitle>
            </div>
          </CardHeader>
          <LeadConversionChart />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Trophy size={14} style={{ color: "var(--amber)" }} weight="fill" />
              <CardTitle>Bài đăng hiệu quả nhất</CardTitle>
            </div>
          </CardHeader>
          {stats.topPosts.length === 0 ? (
            <p className="text-xs text-center py-8" style={{ color: "var(--text-muted)" }}>Chưa có dữ liệu. Thêm số liệu thủ công bên dưới.</p>
          ) : (
            <div className="space-y-2">
              {stats.topPosts.map((post, i) => (
                <div key={post.id} className="flex items-start gap-3 p-2.5 rounded-lg" style={{ background: "var(--bg-subtle)" }}>
                  <span className="text-sm font-bold shrink-0" style={{ color: i === 0 ? "var(--amber)" : "var(--text-muted)" }}>#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs" style={{ color: "var(--text)" }}>{truncate(post.caption, 70)}</p>
                    {post.analytics && (
                      <div className="flex gap-3 mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
                        <span>{post.analytics.likes} likes</span>
                        <span>{post.analytics.comments} cmt</span>
                        <span>{post.analytics.shares} share</span>
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
            <CardTitle>Nhập số liệu thủ công</CardTitle>
            <Button size="sm" variant="secondary" onClick={() => setShowManual(!showManual)}>
              <Plus size={12} /> Thêm
            </Button>
          </CardHeader>
          {showManual && (
            <div className="space-y-2 mb-3">
              <Input label="Post ID" placeholder="ID bài viết" value={manualForm.postId} onChange={(e) => setManualForm({ ...manualForm, postId: e.target.value })} hint="Lấy từ trang Thư viện" />
              <div className="grid grid-cols-2 gap-2">
                <Input label="Tiếp cận" type="number" placeholder="0" value={manualForm.reach} onChange={(e) => setManualForm({ ...manualForm, reach: e.target.value })} />
                <Input label="Like" type="number" placeholder="0" value={manualForm.likes} onChange={(e) => setManualForm({ ...manualForm, likes: e.target.value })} />
                <Input label="Comment" type="number" placeholder="0" value={manualForm.comments} onChange={(e) => setManualForm({ ...manualForm, comments: e.target.value })} />
                <Input label="Share" type="number" placeholder="0" value={manualForm.shares} onChange={(e) => setManualForm({ ...manualForm, shares: e.target.value })} />
              </div>
              <Button size="sm" onClick={handleManualSave} loading={saving} className="w-full">Lưu số liệu</Button>
            </div>
          )}
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {stats.posts.filter((p) => p.analytics).map((post) => (
              <div key={post.id} className="flex items-center gap-2 py-1.5 border-b" style={{ borderColor: "var(--border)" }}>
                <p className="text-xs flex-1 truncate" style={{ color: "var(--text-secondary)" }}>{truncate(post.caption, 40)}</p>
                <div className="flex gap-2 text-[10px] shrink-0" style={{ color: "var(--text-muted)" }}>
                  <span>{post.analytics!.likes}L</span>
                  <span>{post.analytics!.comments}C</span>
                  <span>{post.analytics!.shares}S</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Tất cả bài đã đăng ({stats.posts.length})</CardTitle></CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Nội dung", "Tiếp cận", "Like", "Comment", "Share", "Tương tác"].map((h) => (
                  <th key={h} className="text-left pb-2 pr-4 font-medium" style={{ color: "var(--text-secondary)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.posts.map((post) => (
                <tr key={post.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="py-2 pr-4 max-w-[200px]"><p className="truncate" style={{ color: "var(--text)" }}>{post.caption}</p></td>
                  <td className="py-2 pr-4" style={{ color: "var(--text-secondary)" }}>{post.analytics?.reach.toLocaleString() ?? "-"}</td>
                  <td className="py-2 pr-4" style={{ color: "var(--text-secondary)" }}>{post.analytics?.likes ?? "-"}</td>
                  <td className="py-2 pr-4" style={{ color: "var(--text-secondary)" }}>{post.analytics?.comments ?? "-"}</td>
                  <td className="py-2 pr-4" style={{ color: "var(--text-secondary)" }}>{post.analytics?.shares ?? "-"}</td>
                  <td className="py-2">
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
      </Card>
    </div>
  );
}
