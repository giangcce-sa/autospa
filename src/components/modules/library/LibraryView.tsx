"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Archive, Trash, CalendarBlank, PaperPlaneTilt } from "@phosphor-icons/react";
import { formatDateTime, truncate } from "@/lib/utils";

interface Post {
  id: string;
  caption: string;
  hashtags: string | null;
  platform: string;
  postType: string;
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  qualityScore: number | null;
  service: { name: string } | null;
  createdAt: string;
}

const tabs = [
  { label: "Tất cả", value: "" },
  { label: "Nháp", value: "draft" },
  { label: "Lên lịch", value: "scheduled" },
  { label: "Đã đăng", value: "published" },
];

export function LibraryView() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [activeTab, setActiveTab] = useState("");
  const [loading, setLoading] = useState(true);

  const load = (status = "") => {
    setLoading(true);
    fetch(`/api/content/list${status ? `?status=${status}` : ""}`)
      .then((r) => r.json())
      .then((res) => res.data && setPosts(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleTabChange = (val: string) => { setActiveTab(val); load(val); };

  const handleDelete = async (id: string) => {
    if (!confirm("Xóa bài viết này?")) return;
    await fetch("/api/content/list", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    load(activeTab);
  };

  const handleReuse = (id: string) => {
    router.push(`/publish?postId=${id}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1 p-1 rounded-lg w-fit" style={{ background: "var(--bg-subtle)" }}>
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleTabChange(tab.value)}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{
              background: activeTab === tab.value ? "var(--bg-card)" : "transparent",
              color: activeTab === tab.value ? "var(--text)" : "var(--text-muted)",
              boxShadow: activeTab === tab.value ? "var(--shadow-sm)" : "none",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}
        </div>
      ) : posts.length === 0 ? (
        <EmptyState icon={<Archive size={40} />} title="Chưa có bài viết nào" description="Tạo nội dung và lưu vào thư viện" />
      ) : (
        <div className="space-y-2">
          {posts.map((post) => (
            <Card key={post.id} className="group">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <StatusBadge status={post.status} />
                    {post.service && <span className="text-xs" style={{ color: "var(--text-muted)" }}>{post.service.name}</span>}
                    {post.qualityScore && (
                      <span className="text-xs font-medium" style={{ color: post.qualityScore >= 80 ? "var(--accent)" : "var(--amber)" }}>
                        {post.qualityScore}/100
                      </span>
                    )}
                  </div>
                  <p className="text-sm" style={{ color: "var(--text)" }}>{truncate(post.caption, 120)}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                    <span>{formatDateTime(post.createdAt)}</span>
                    {post.scheduledAt && (
                      <span className="flex items-center gap-1">
                        <CalendarBlank size={10} /> {formatDateTime(post.scheduledAt)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity">
                  <Button size="sm" variant="secondary" onClick={() => handleReuse(post.id)} title="Dùng lại bài này">
                    <PaperPlaneTilt size={12} weight="fill" /> Dùng lại
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(post.id)} style={{ color: "var(--rose)" }}>
                    <Trash size={13} />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
