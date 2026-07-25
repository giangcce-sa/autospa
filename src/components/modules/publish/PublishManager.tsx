"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ChannelMediaPreview } from "@/components/media/ChannelMediaPreview";
import { Textarea } from "@/components/ui/Input";
import { StatusBadge } from "@/components/ui/Badge";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FacebookLogo, PaperPlaneTilt, CalendarBlank, FloppyDisk,
  User, ThumbsUp, ChatCircle, Share, CaretDown, Image as ImageIcon,
  CheckCircle, Sparkle, Megaphone, Clock, InstagramLogo,
} from "@phosphor-icons/react";
import { ReviewBadge, type ReviewIssue } from "@/components/ui/ReviewBadge";

interface FbPage { id: string; fbPageId: string; pageName: string; isActive: boolean; }

interface PublishChannelState {
  channel: string;
  status: string;
  externalId: string | null;
  error: string | null;
}

interface PublishOperationState {
  id: string;
  status: string;
  error: string | null;
  channelAttempts: PublishChannelState[];
}

export interface PublishingPostData {
  id: string;
  caption: string;
  hashtags: string | null;
  imageUrl: string | null;
  facebookPageId: string | null;
  postType: string;
  tone: string;
  platform: string;
  status?: string;
  scheduledAt?: string | null;
  service?: { name: string } | null;
  publishOperations?: PublishOperationState[];
  createdAt?: string;
}

function sourceLabelForPost(post: PublishingPostData) {
  return post.service?.name ? `Bài đã lưu · ${post.service.name}` : "Bài đã lưu";
}

function toLocalDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

interface Props {
  initialPostId?: string;
  initialPost?: PublishingPostData;
  initialReview?: { status: "pass" | "warn" | "fail"; score: number; issues: ReviewIssue[] } | null;
  initialImageUrl?: string;
  facebookPageId?: string;
  onPostIdChange?: (postId?: string) => void;
}

export function PublishManager({ initialPostId, initialPost, initialReview, initialImageUrl, facebookPageId, onPostIdChange }: Props) {
  const router = useRouter();
  const [postId, setPostId] = useState<string | undefined>(initialPostId);
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [postType, setPostType] = useState("service");
  const [imageUrl, setImageUrl] = useState(initialImageUrl ?? "");
  const [scheduledAt, setScheduledAt] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [publishOperation, setPublishOperation] = useState<PublishOperationState | null>(null);
  const [error, setError] = useState("");
  const [sourceLabel, setSourceLabel] = useState<string | null>(null);
  const postLoadController = useRef<AbortController | null>(null);
  const publishRequestRef = useRef<{ fingerprint: string; key: string } | null>(null);

  // Draft picker
  const [drafts, setDrafts] = useState<PublishingPostData[]>([]);
  const [showDrafts, setShowDrafts] = useState(false);
  const [loadingDrafts, setLoadingDrafts] = useState(false);

  // Best time suggestion
  const [bestTimeHint, setBestTimeHint] = useState<string | null>(null);
  const [loadingBestTime, setLoadingBestTime] = useState(false);

  // Reviewer state
  const [review, setReview] = useState<{ status: "pass" | "warn" | "fail"; score: number; issues: ReviewIssue[] } | null>(null);
  const [reviewBlocked, setReviewBlocked] = useState(false);

  // Facebook pages
  const [fbPages, setFbPages] = useState<FbPage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string>("");

  // Multi-platform
  const [publishToInstagram, setPublishToInstagram] = useState(false);
  const [publishToTikTok, setPublishToTikTok] = useState(false);
  const [igConnected, setIgConnected] = useState(false);
  const [tiktokConnected, setTiktokConnected] = useState(false);

  useEffect(() => {
    fetch("/api/facebook-pages").then((r) => r.json()).then((res) => {
      if (res.data) {
        const active = res.data.filter((p: FbPage) => p.isActive);
        setFbPages(active);
        if (facebookPageId && active.some((page: FbPage) => page.id === facebookPageId)) {
          setSelectedPageId(facebookPageId);
        } else if (active.length > 0) {
          setSelectedPageId((current) => current || active[0].id);
        }
      }
    });
    fetch("/api/instagram").then((r) => r.json()).then((res) => {
      if (res.success) setIgConnected(res.data.some((p: { igAccountId: string | null }) => p.igAccountId));
    });
    fetch("/api/tiktok?action=accounts").then((r) => r.json()).then((res) => {
      if (res.success) setTiktokConnected(res.data.some((a: { isActive: boolean }) => a.isActive));
    });
  }, [facebookPageId]);

  useEffect(() => {
    if (facebookPageId) setSelectedPageId(facebookPageId);
  }, [facebookPageId]);

  useEffect(() => {
    setImageUrl(initialImageUrl ?? "");
  }, [initialImageUrl]);

  useEffect(() => {
    const controller = new AbortController();
    postLoadController.current = controller;
    const resolvedPostId = initialPost?.id ?? initialPostId;
    setPostId(resolvedPostId);
    setCaption(initialPost?.caption ?? "");
    setHashtags(initialPost?.hashtags ?? "");
    setPostType(initialPost?.postType ?? "service");
    setImageUrl(initialPost?.imageUrl ?? (resolvedPostId ? "" : initialImageUrl ?? ""));
    setScheduledAt(toLocalDateTime(initialPost?.scheduledAt));
    setStatus(initialPost?.status ?? null);
    setPublishOperation(initialPost?.publishOperations?.[0] ?? null);
    setError("");
    setSourceLabel(initialPost ? sourceLabelForPost(initialPost) : null);
    setReview(initialReview ?? null);
    setReviewBlocked(false);
    if (initialPost?.facebookPageId) setSelectedPageId(initialPost.facebookPageId);

    if (!resolvedPostId || initialPost) return () => controller.abort();

    const loadPost = async () => {
      try {
        const response = await fetch(`/api/publish?postId=${resolvedPostId}`, { signal: controller.signal });
        const result = await response.json();
        if (!response.ok || !result.data) {
          setError(result.error ?? "Không tải được bài viết");
          return;
        }

        setCaption(result.data.caption ?? "");
        setHashtags(result.data.hashtags ?? "");
        setPostType(result.data.postType ?? "service");
        setImageUrl(result.data.imageUrl ?? "");
        setSelectedPageId(result.data.facebookPageId ?? "");
        setSourceLabel(sourceLabelForPost(result.data));
        setStatus(result.data.status ?? null);
        setPublishOperation(result.data.publishOperations?.[0] ?? null);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setError("Không tải được bài viết");
      }
    };

    loadPost();
    return () => {
      controller.abort();
      if (postLoadController.current === controller) postLoadController.current = null;
    };
  }, [initialImageUrl, initialPost, initialPostId, initialReview]);

  const loadDrafts = async () => {
    setLoadingDrafts(true);
    try {
      const params = new URLSearchParams({ status: "draft" });
      if (facebookPageId) params.set("facebookPageId", facebookPageId);
      const res = await fetch(`/api/content/list?${params.toString()}`);
      const data = await res.json();
      setDrafts(data.data ?? []);
      setShowDrafts(true);
    } finally {
      setLoadingDrafts(false);
    }
  };

  const resetReviewState = () => {
    setReview(null);
    setReviewBlocked(false);
  };

  const pickDraft = (draft: PublishingPostData) => {
    postLoadController.current?.abort();
    setPostId(draft.id);
    onPostIdChange?.(draft.id);
    setCaption(draft.caption ?? "");
    setHashtags(draft.hashtags ?? "");
    setPostType(draft.postType ?? "service");
    setImageUrl(draft.imageUrl ?? "");
    setSelectedPageId(draft.facebookPageId ?? "");
    setSourceLabel(sourceLabelForPost(draft));
    setScheduledAt(toLocalDateTime(draft.scheduledAt));
    setStatus(draft.status ?? null);
    setPublishOperation(draft.publishOperations?.[0] ?? null);
    resetReviewState();
    setError(draft.postType === "video" ? "Video chỉ được xuất bản từ Xưởng video sau khi render, QA và duyệt đúng phiên bản." : "");
    setShowDrafts(false);
  };

  const handleAction = async (action: string, force = false) => {
    if (!caption.trim()) return;
    if (postType === "video" && action !== "draft") {
      setError("Video chỉ được xuất bản từ Xưởng video sau khi render, QA và duyệt đúng phiên bản.");
      return;
    }
    setLoading(action);
    setError("");
    setReviewBlocked(false);
    try {
      const publishFingerprint = JSON.stringify({
        postId,
        caption,
        hashtags,
        imageUrl: imageUrl.trim() || null,
        facebookPageId: (facebookPageId ?? selectedPageId) || null,
        publishToInstagram,
        publishToTikTok,
      });
      if (action === "publish-now" && publishRequestRef.current?.fingerprint !== publishFingerprint) {
        publishRequestRef.current = { fingerprint: publishFingerprint, key: crypto.randomUUID() };
      }
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          postId,
          caption,
          hashtags,
          postType,
          imageUrl: imageUrl.trim() || undefined,
          scheduledAt: scheduledAt || undefined,
          facebookPageId: (facebookPageId ?? selectedPageId) || undefined,
          force,
          idempotencyKey: action === "publish-now" ? publishRequestRef.current?.key : undefined,
          publishToInstagram: action === "publish-now" ? publishToInstagram : false,
          publishToTikTok: action === "publish-now" ? publishToTikTok : false,
        }),
      });
      const data = await res.json();
      if (data.data?.id) {
        setPostId(data.data.id);
        onPostIdChange?.(data.data.id);
      }
      if (res.status === 422 && data.error === "REVIEW_BLOCKED") {
        setReview(data.review);
        setReviewBlocked(true);
        setError("Reviewer Agent đã chặn vì có vấn đề nghiêm trọng. Sửa nội dung hoặc nhấn 'Đăng mặc dù' để bỏ qua.");
        return;
      }
      if (data.operation) setPublishOperation(data.operation);
      if (!res.ok) {
        const facebookResult = typeof data.results?.facebook === "string"
          ? data.results.facebook.replace(/^error:/, "").trim()
          : "";
        setStatus(data.data?.status ?? null);
        setError(data.error || facebookResult || "Không thể đăng bài lên Facebook. Hãy kiểm tra kết nối và thử lại.");
        return;
      }
      setStatus(data.data.status);
    } finally { setLoading(null); }
  };

  const suggestBestTime = async () => {
    setLoadingBestTime(true);
    try {
      const res = await fetch("/api/analytics?action=best-times");
      const data = await res.json();
      if (data.success && data.data.suggestion !== null) {
        const hour = data.data.suggestion as number;
        const now = new Date();
        now.setHours(hour, 0, 0, 0);
        if (now <= new Date()) now.setDate(now.getDate() + 1);
        setScheduledAt(now.toISOString().slice(0, 16));
        setBestTimeHint(data.data.message);
      } else {
        setBestTimeHint(data.data?.message ?? "Chưa đủ dữ liệu");
      }
    } finally { setLoadingBestTime(false); }
  };

  const fullText = [caption, hashtags].filter(Boolean).join("\n\n");

  return (
    <div className="space-y-3 max-w-5xl">
      {/* Draft picker bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {sourceLabel && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
            <CheckCircle size={12} weight="fill" />
            {sourceLabel}
          </div>
        )}
        <Button size="sm" variant="secondary" loading={loadingDrafts} onClick={loadDrafts}>
          <Sparkle size={12} /> Chọn bài nháp
          <CaretDown size={10} />
        </Button>
        {sourceLabel && (
          <button className="text-xs underline" style={{ color: "var(--text-muted)" }} onClick={() => { postLoadController.current?.abort(); setPostId(undefined); onPostIdChange?.(undefined); setCaption(""); setHashtags(""); setPostType("service"); setImageUrl(""); setSelectedPageId(""); setSourceLabel(null); setStatus(null); setPublishOperation(null); setError(""); resetReviewState(); }}>
            Xóa, tạo bài mới
          </button>
        )}
      </div>

      {/* Draft dropdown */}
      {showDrafts && (
        <Card>
          <CardHeader>
            <CardTitle>Chọn bài nháp</CardTitle>
            <button onClick={() => setShowDrafts(false)} className="text-xs" style={{ color: "var(--text-muted)" }}>Đóng</button>
          </CardHeader>
          {drafts.length === 0 ? (
            <p className="text-xs py-2" style={{ color: "var(--text-muted)" }}>Chưa có bài nháp nào. Tạo nội dung AI trước rồi lưu nháp.</p>
          ) : (
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {drafts.map((d) => (
                <button key={d.id} onClick={() => pickDraft(d)}
                  className="w-full text-left p-2.5 rounded-lg transition-colors hover:opacity-80"
                  style={{ background: "var(--bg-subtle)" }}>
                  <p className="text-xs font-medium line-clamp-1" style={{ color: "var(--text)" }}>{d.caption || "(Không có caption)"}</p>
                  <div className="flex gap-2 mt-0.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
                    {d.service?.name && <span>{d.service.name}</span>}
                    <span>{d.platform}</span>
                    {d.createdAt && <span>{new Date(d.createdAt).toLocaleDateString("vi-VN")}</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Nội dung bài đăng</CardTitle></CardHeader>
          <div className="space-y-3">
            <Textarea
              label="Caption"
              placeholder="Nội dung bài viết..."
              rows={6}
              value={caption}
              onChange={(e) => {
                setCaption(e.target.value);
                resetReviewState();
              }}
            />
            <Textarea
              label="Hashtags"
              placeholder="#spa #lamdep #chamsocda"
              rows={2}
              value={hashtags}
              onChange={(e) => {
                setHashtags(e.target.value);
                resetReviewState();
              }}
            />

            {/* Image URL */}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                Media đính kèm (URL legacy)
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://... hoặc dán URL ảnh vào đây"
                  className="flex-1 px-3 py-2 text-xs rounded-lg border outline-none"
                  style={{ background: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text)" }}
                  value={imageUrl}
                  onChange={(e) => {
                    setImageUrl(e.target.value);
                    resetReviewState();
                  }}
                />
                {imageUrl && (
                  <button
                    onClick={() => {
                      setImageUrl("");
                      resetReviewState();
                    }}
                    aria-label="Xóa media đính kèm"
                    className="min-h-11 min-w-11 rounded-lg px-2 text-xs"
                    style={{ color: "var(--text-muted)", background: "var(--bg-subtle)" }}
                  >
                    Xóa
                  </button>
                )}
              </div>
              <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                Tạo hình AI rồi nhấn "Gắn vào bài đăng" để tự điền — hoặc dán URL ảnh bất kỳ.
              </p>
            </div>

            {/* Schedule */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Lên lịch đăng (tùy chọn)</label>
                <button
                  onClick={suggestBestTime}
                  disabled={loadingBestTime}
                  className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full transition-opacity hover:opacity-70"
                  style={{ background: "var(--accent-light)", color: "var(--accent)" }}
                >
                  <Clock size={10} />
                  {loadingBestTime ? "..." : "AI gợi ý giờ"}
                </button>
              </div>
              <input
                type="datetime-local"
                className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
                style={{ background: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text)" }}
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
              />
              {bestTimeHint && (
                <p className="text-[10px] px-2 py-1 rounded" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
                  {bestTimeHint}
                </p>
              )}
            </div>

            {/* Page selector */}
            {fbPages.length > 0 && (
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
                  <FacebookLogo size={11} color="#1877F2" className="inline mr-1" /> Đăng lên page
                </label>
                <select
                  className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
                  style={{ background: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text)" }}
                  value={selectedPageId}
                  onChange={(e) => setSelectedPageId(e.target.value)}
                  disabled={Boolean(facebookPageId)}
                >
                  {fbPages.map((p) => (
                    <option key={p.id} value={p.id}>{p.pageName}</option>
                  ))}
                </select>
              </div>
            )}
            {fbPages.length === 0 && (
              <p className="text-xs p-2 rounded" style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}>
                Chưa có Facebook Page — vào <strong>Cài đặt</strong> để thêm page trước khi đăng.
              </p>
            )}

            {error === "FB_NO_MANAGE_POSTS" ? (
              <div className="rounded-lg overflow-hidden text-xs" style={{ border: "1px solid var(--amber)", background: "var(--amber-light)" }}>
                <div className="px-3 py-2 font-medium" style={{ color: "var(--amber)" }}>
                  Token thiếu quyền <code>pages_manage_posts</code>
                </div>
                <div className="px-3 pb-3 space-y-1" style={{ color: "var(--text-secondary)" }}>
                  <p>Token hiện tại chỉ đọc được bài, chưa đăng được. Lấy token mới:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Vào <strong>developers.facebook.com/tools/explorer</strong></li>
                    <li>Chọn <strong>Page Access Token</strong> đúng trang</li>
                    <li>Thêm cả 2 quyền: <code>pages_read_engagement</code> + <code>pages_manage_posts</code></li>
                    <li>Generate → Copy → vào <strong>Cài đặt → Facebook Page</strong> → Lưu</li>
                    <li>Quay lại và thử đăng lại</li>
                  </ol>
                </div>
              </div>
            ) : error ? (
              <p className="text-xs p-2 rounded" style={{ background: "var(--rose-light)", color: "var(--rose)" }}>{error}</p>
            ) : null}
            {status && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={status} />
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {publishOperation?.status === "needs_reconciliation"
                      ? "Cần đối soát trước khi thử lại"
                      : publishOperation?.status === "partial"
                        ? "Một số kênh đã đăng thành công"
                        : status === "published"
                          ? "Đã đăng thành công"
                          : "Trạng thái đã được lưu"}
                  </span>
                  {status === "published" && postId && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => router.push(`/facebook-ads?postId=${postId}`)}
                    >
                      <Megaphone size={12} /> Chạy quảng cáo
                    </Button>
                  )}
                </div>
                {publishOperation && (
                  <div className="grid gap-1 sm:grid-cols-3">
                    {publishOperation.channelAttempts.map((attempt) => (
                      <div key={`${attempt.channel}-${attempt.status}`} className="rounded-md border px-2 py-1.5 text-[11px]" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                        <strong className="capitalize">{attempt.channel}</strong>: {attempt.status}
                        {attempt.error ? <p className="mt-0.5" style={{ color: "var(--rose)" }}>{attempt.error}</p> : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Reviewer Agent badge */}
            {review && <ReviewBadge review={review} />}

            {/* Multi-platform targets */}
            <div className="flex items-center gap-3 flex-wrap text-[12px]">
              <span className="font-semibold" style={{ color: "var(--text-muted)" }}>Đăng lên:</span>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <FacebookLogo size={14} style={{ color: "#1877F2" }} />
                <input type="checkbox" checked disabled className="w-3 h-3 accent-blue-500" />
                <span style={{ color: "var(--text)" }}>Facebook</span>
              </label>
              {igConnected && (
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <InstagramLogo size={14} style={{ color: "#E1306C" }} />
                  <input type="checkbox" checked={publishToInstagram} onChange={(e) => setPublishToInstagram(e.target.checked)} className="w-3 h-3 accent-pink-500" />
                  <span style={{ color: "var(--text)" }}>Instagram</span>
                </label>
              )}
              {tiktokConnected && (
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <span style={{ color: "var(--text)", fontSize: 14, fontWeight: "bold" }}>TT</span>
                  <input type="checkbox" checked={publishToTikTok} onChange={(e) => setPublishToTikTok(e.target.checked)} className="w-3 h-3" />
                  <span style={{ color: "var(--text)" }}>TikTok</span>
                </label>
              )}
              {!igConnected && !tiktokConnected && (
                <Link href="/system/settings?view=channels&scope=account" className="text-[11px] underline" style={{ color: "var(--text-muted)" }}>
                  Thêm Instagram / TikTok →
                </Link>
              )}
            </div>

            {postType === "video" && (
              <div className="rounded-lg border p-3 text-xs" style={{ borderColor: "var(--amber)", background: "var(--amber-light)", color: "var(--text-secondary)" }}>
                Video cần được render, kiểm tra QA và duyệt đúng phiên bản trong Xưởng video trước khi xuất bản.
                <Button size="sm" variant="secondary" className="mt-2" onClick={() => router.push("/creative/video")}>
                  Mở Xưởng video
                </Button>
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              <Button variant="secondary" onClick={() => handleAction("draft")} loading={loading === "draft"} className="flex-1">
                <FloppyDisk size={13} /> Lưu nháp
              </Button>
              {scheduledAt && postType !== "video" && (
                <Button variant="secondary" onClick={() => handleAction("schedule")} loading={loading === "schedule"} className="flex-1">
                  <CalendarBlank size={13} /> Lên lịch
                </Button>
              )}
              {postType !== "video" && (reviewBlocked ? (
                <Button onClick={() => handleAction("publish-now", true)} loading={loading === "publish-now"} variant="danger" className="flex-1">
                  <PaperPlaneTilt size={13} weight="fill" /> Đăng mặc dù
                </Button>
              ) : (
                <Button onClick={() => handleAction("publish-now")} loading={loading === "publish-now"} className="flex-1">
                  <PaperPlaneTilt size={13} weight="fill" /> Đăng ngay
                </Button>
              ))}
            </div>
          </div>
        </Card>

        {/* Facebook preview */}
        <Card>
          <CardHeader>
            <CardTitle>Xem trước Facebook</CardTitle>
            <FacebookLogo size={16} color="#1877F2" />
          </CardHeader>
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
            <div className="p-3 border-b flex items-center gap-2.5" style={{ borderColor: "var(--border)" }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--bg-subtle)" }}>
                <User size={18} style={{ color: "var(--text-muted)" }} />
              </div>
              <div>
                <p className="text-xs font-semibold" style={{ color: "var(--text)" }}>Spa của bạn</p>
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {scheduledAt ? new Date(scheduledAt).toLocaleString("vi-VN") : "Vừa xong"} · Công khai
                </p>
              </div>
            </div>

            {fullText && (
              <div className="p-3 border-b" style={{ borderColor: "var(--border)" }}>
                <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: "var(--text)" }}>{fullText}</p>
              </div>
            )}

            {imageUrl ? (
              <div className="p-3">
                <ChannelMediaPreview mediaUrl={imageUrl} kind={postType === "video" ? "video" : "image"} title="Media bài đăng" />
              </div>
            ) : (
              !fullText && (
                <div className="p-6 text-center" style={{ color: "var(--text-muted)" }}>
                  <ImageIcon size={28} className="mx-auto mb-1 opacity-20" />
                  <p className="text-xs">Nội dung bài viết sẽ hiển thị ở đây...</p>
                </div>
              )
            )}

            {!imageUrl && fullText && (
              <div className="px-3 py-2 flex items-center gap-1 text-[10px]" style={{ color: "var(--text-muted)", background: "var(--bg-subtle)" }}>
                <ImageIcon size={11} />
                <span>Chưa có hình — tạo ảnh AI rồi nhấn "Gắn vào bài đăng"</span>
              </div>
            )}

            <div className="px-3 py-2 border-t flex items-center gap-4 text-xs" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
              <button className="flex items-center gap-1 hover:opacity-70"><ThumbsUp size={13} /> Thích</button>
              <button className="flex items-center gap-1 hover:opacity-70"><ChatCircle size={13} /> Bình luận</button>
              <button className="flex items-center gap-1 hover:opacity-70"><Share size={13} /> Chia sẻ</button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
