"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { MediaThumbnail } from "@/components/media/MediaThumbnail";
import { StatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Archive, Trash, CalendarBlank, PaperPlaneTilt } from "@phosphor-icons/react";
import { formatDateTime, truncate } from "@/lib/utils";

interface Post {
  id: string;
  caption: string;
  hashtags: string | null;
  imageUrl: string | null;
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

export function LibraryView({
  facebookPageId,
  canonical = false,
  canMutate = true,
  initialStatus,
  initialQuery,
  canonicalView = "library",
}: {
  facebookPageId?: string;
  canonical?: boolean;
  canMutate?: boolean;
  initialStatus?: string;
  initialQuery?: string;
  canonicalView?: string;
} = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const canonicalStatus = tabs.some((tab) => tab.value === initialStatus) ? initialStatus ?? "" : "";
  const [localStatus, setLocalStatus] = useState("");
  const [localQuery, setLocalQuery] = useState("");
  const [searchInput, setSearchInput] = useState(initialQuery ?? "");
  const activeTab = canonical ? canonicalStatus : localStatus;
  const query = canonical ? initialQuery ?? "" : localQuery;
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    const controller = new AbortController();
    setLoading(true);
    const params = new URLSearchParams();
    if (activeTab) params.set("status", activeTab);
    if (query) params.set("q", query);
    if (facebookPageId) params.set("facebookPageId", facebookPageId);
    fetch(`/api/content/list${params.size ? `?${params.toString()}` : ""}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((res) => res.data && setPosts(res.data))
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) throw error;
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [activeTab, facebookPageId, query]);

  useEffect(() => load(), [load]);
  useEffect(() => {
    if (canonical) setSearchInput(initialQuery ?? "");
  }, [canonical, initialQuery]);

  const updateFilters = (status: string, nextQuery: string) => {
    if (!canonical) return;
    const params = new URLSearchParams({ view: canonicalView, scope: "current" });
    if (facebookPageId) params.set("pageId", facebookPageId);
    if (status) params.set("status", status);
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleTabChange = (status: string) => {
    if (canonical) updateFilters(status, query);
    else setLocalStatus(status);
  };

  const handleSearch = () => {
    if (canonical) updateFilters(activeTab, searchInput);
    else setLocalQuery(searchInput.trim());
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Xóa bài viết này?")) return;
    await fetch("/api/content/list", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    load();
  };

  const handleReuse = (id: string) => {
    if (canonical) {
      const params = new URLSearchParams({ view: "composer", scope: "current", id });
      if (facebookPageId) params.set("pageId", facebookPageId);
      router.push(`/creative/publishing?${params.toString()}`);
      return;
    }
    router.push(`/publish?postId=${id}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex gap-1 rounded-lg p-1" style={{ background: "var(--bg-subtle)" }}>
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => handleTabChange(tab.value)}
              className="min-h-11 rounded-md px-3 text-xs font-medium transition-all"
              aria-pressed={activeTab === tab.value}
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
        <form
          className="flex w-full gap-2 sm:w-auto"
          onSubmit={(event) => {
            event.preventDefault();
            handleSearch();
          }}
        >
          <Input
            type="search"
            aria-label="Tìm nội dung"
            placeholder="Tìm caption, hashtag..."
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="sm:w-64"
          />
          <Button type="submit" variant="secondary">Tìm</Button>
        </form>
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
            <Card key={post.id} className="group" padding="none">
              <div className="grid gap-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
                <MediaThumbnail
                  src={post.imageUrl}
                  alt={post.caption || "Media bài viết"}
                  kind={post.postType === "video" ? "video" : "image"}
                  aspectRatio={post.postType === "video" ? "16:9" : "feed"}
                  className="h-full min-h-32 rounded-t-xl sm:rounded-l-xl sm:rounded-tr-none"
                />
                <div className="flex min-w-0 items-start gap-3 p-4 sm:pl-1">
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
                <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  <Button size="sm" variant="secondary" onClick={() => handleReuse(post.id)} title="Dùng lại bài này">
                    <PaperPlaneTilt size={12} weight="fill" /> Dùng lại
                  </Button>
                  {canMutate && (
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(post.id)} style={{ color: "var(--rose)" }} aria-label="Xóa bài viết">
                      <Trash size={13} aria-hidden="true" />
                    </Button>
                  )}
                </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
