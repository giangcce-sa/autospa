"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Archive, CalendarBlank, MagnifyingGlass, PaperPlaneTilt, TrashSimple, Warning } from "@phosphor-icons/react";
import { MediaThumbnail } from "@/components/media/MediaThumbnail";
import { POST_STATUS_LABELS, POST_TYPE_LABELS, PLATFORM_LABELS, label } from "@/lib/creative-labels";
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

const TABS = [
  { label: "Tất cả", value: "" },
  { label: "Nháp", value: "draft" },
  { label: "Lên lịch", value: "scheduled" },
  { label: "Đã đăng", value: "published" },
];

const STATUS_TONE: Record<string, string> = {
  draft: "bg-[var(--bg-subtle)] text-[var(--text-secondary)]",
  scheduled: "bg-[var(--amber-light)] text-[var(--amber)]",
  published: "bg-[var(--green-light)] text-[var(--green)]",
  failed: "bg-[var(--danger-light)] text-[var(--danger)]",
};

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
  const canonicalStatus = TABS.some((tab) => tab.value === initialStatus) ? initialStatus ?? "" : "";
  const [localStatus, setLocalStatus] = useState("");
  const [localQuery, setLocalQuery] = useState("");
  const [searchInput, setSearchInput] = useState(initialQuery ?? "");
  const activeTab = canonical ? canonicalStatus : localStatus;
  const query = canonical ? initialQuery ?? "" : localQuery;
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    const controller = new AbortController();
    setLoading(true);
    const params = new URLSearchParams();
    if (activeTab) params.set("status", activeTab);
    if (query) params.set("q", query);
    if (facebookPageId) params.set("facebookPageId", facebookPageId);
    setError("");
    fetch(`/api/content/list${params.size ? `?${params.toString()}` : ""}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success) throw new Error(payload?.error ?? "Không tải được thư viện nội dung");
        return payload;
      })
      .then((payload) => setPosts(payload.data ?? []))
      .catch((cause) => {
        if (!(cause instanceof DOMException && cause.name === "AbortError")) {
          setError(cause instanceof Error ? cause.message : "Không tải được thư viện nội dung");
        }
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

  // Inline confirmation rather than window.confirm: the dialog is unstyled, and
  // deleting a post is worth naming what is about to be deleted.
  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setError("");
    try {
      const response = await fetch("/api/content/list", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(payload?.error ?? "Không xóa được bài viết");
        return;
      }
      setConfirmId(null);
      load();
    } catch {
      setError("Không xóa được bài viết");
    } finally {
      setDeletingId(null);
    }
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-[10px] bg-[var(--bg-subtle)] p-1">
          {TABS.map((tab) => {
            const active = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => handleTabChange(tab.value)}
                aria-pressed={active}
                className={`min-h-10 rounded-[7px] px-3 text-[12.5px] font-bold transition-colors ${
                  active
                    ? "bg-[var(--bg-card)] text-[var(--text)] shadow-[var(--shadow-sm)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <form
          className="flex w-full gap-2 sm:w-auto"
          onSubmit={(event) => {
            event.preventDefault();
            handleSearch();
          }}
        >
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-[9px] border border-[var(--border-strong)] bg-[var(--bg)] px-3 focus-within:border-[var(--accent)] sm:w-64 sm:flex-none">
            <MagnifyingGlass size={15} className="shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
            <span className="sr-only">Tìm nội dung</span>
            <input
              type="search"
              placeholder="Tìm caption, hashtag…"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="min-w-0 flex-1 bg-transparent py-2 text-[13px] text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
            />
          </label>
          <button
            type="submit"
            className="flex min-h-10 shrink-0 items-center rounded-[9px] border border-[var(--border-strong)] px-3.5 text-[12.5px] font-bold text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            Tìm
          </button>
        </form>
      </div>

      {error && (
        <p role="alert" className="rounded-[9px] bg-[var(--danger-light)] px-3 py-2 text-[12.5px] font-semibold text-[var(--danger)]">
          {error}
        </p>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((key) => <div key={key} className="skeleton h-28 rounded-[var(--radius-xl)]" />)}
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-card)] py-14 text-center">
          <Archive size={28} className="text-[var(--text-muted)]" aria-hidden="true" />
          <p className="text-[13.5px] font-semibold">Chưa có bài viết nào</p>
          <p className="max-w-sm text-[12.5px] text-[var(--text-muted)]">
            {query || activeTab ? "Không có bài nào khớp bộ lọc hiện tại." : "Nội dung đã tạo sẽ xuất hiện ở đây."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {posts.map((post) => (
            <li
              key={post.id}
              className="surface-hover overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-card)] shadow-[var(--shadow-sm)]"
            >
              <div className="grid gap-3 sm:grid-cols-[8.5rem_minmax(0,1fr)]">
                <MediaThumbnail
                  src={post.imageUrl}
                  alt={post.caption || "Media bài viết"}
                  kind={post.postType === "video" ? "video" : "image"}
                  aspectRatio={post.postType === "video" ? "16:9" : "feed"}
                  className="h-full min-h-28"
                />
                <div className="flex min-w-0 flex-wrap items-start gap-3 p-4 sm:pl-0">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                      <span className={`rounded-[5px] px-1.5 py-0.5 font-bold ${STATUS_TONE[post.status] ?? STATUS_TONE.draft}`}>
                        {label(POST_STATUS_LABELS, post.status)}
                      </span>
                      <span className="rounded-[5px] bg-[var(--bg-subtle)] px-1.5 py-0.5 font-bold text-[var(--text-secondary)]">
                        {label(POST_TYPE_LABELS, post.postType)}
                      </span>
                      <span className="text-[var(--text-muted)]">{label(PLATFORM_LABELS, post.platform)}</span>
                      {post.service && <span className="truncate text-[var(--text-muted)]">{post.service.name}</span>}
                      {/* A stored 0 is a real score, so test for null rather than truthiness. */}
                      {post.qualityScore !== null && (
                        <span
                          className={`font-bold tabular-nums ${
                            post.qualityScore >= 80 ? "text-[var(--green)]" : post.qualityScore >= 60 ? "text-[var(--amber)]" : "text-[var(--danger)]"
                          }`}
                        >
                          {post.qualityScore}/100
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] leading-relaxed text-[var(--text)]">{truncate(post.caption, 160)}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--text-muted)]">
                      <span>Tạo {formatDateTime(post.createdAt)}</span>
                      {post.scheduledAt && (
                        <span className="flex items-center gap-1">
                          <CalendarBlank size={11} aria-hidden="true" />{formatDateTime(post.scheduledAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleReuse(post.id)}
                      className="flex min-h-10 items-center gap-1.5 rounded-[8px] border border-[var(--border-strong)] px-3 text-[12.5px] font-bold text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    >
                      <PaperPlaneTilt size={13} weight="fill" aria-hidden="true" />Dùng lại
                    </button>
                    {canMutate && (
                      <button
                        type="button"
                        onClick={() => setConfirmId(post.id)}
                        aria-label="Xóa bài viết"
                        className="flex h-10 w-10 items-center justify-center rounded-[8px] text-[var(--text-muted)] transition-colors hover:bg-[var(--danger-light)] hover:text-[var(--danger)]"
                      >
                        <TrashSimple size={15} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {confirmId === post.id && (
                <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] bg-[var(--danger-light)] px-4 py-3">
                  <p className="flex min-w-0 flex-1 items-start gap-2 text-[12.5px] font-semibold text-[var(--danger)]">
                    <Warning size={15} weight="fill" className="mt-px shrink-0" aria-hidden="true" />
                    <span className="min-w-0">
                      Xóa hẳn “{truncate(post.caption, 60)}”? Thao tác này không hoàn lại được.
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={() => handleDelete(post.id)}
                    disabled={deletingId === post.id}
                    className="flex min-h-10 shrink-0 items-center rounded-[8px] bg-[var(--danger)] px-3 text-[12.5px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {deletingId === post.id ? "Đang xóa…" : "Xóa"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmId(null)}
                    className="flex min-h-10 shrink-0 items-center rounded-[8px] border border-[var(--danger)]/40 px-3 text-[12.5px] font-semibold text-[var(--danger)]"
                  >
                    Giữ lại
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
