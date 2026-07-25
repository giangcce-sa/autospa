"use client";

import { useEffect, useRef, useState } from "react";
import { DownloadSimple, ThumbsDown, ThumbsUp } from "@phosphor-icons/react";
import { MediaAssetCard } from "@/components/media/MediaAssetCard";
import { MediaPreviewDialog } from "@/components/media/MediaPreviewDialog";
import { MediaStatusBadge } from "@/components/media/MediaStatusBadge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import type { ImageHistoryItem } from "@/lib/image-history";
import { imageReviewStatus } from "@/lib/media-gallery";
import { formatDate, formatDateTime } from "@/lib/utils";

export function ImageLibrary({
  facebookPageId,
  initialItems,
  initialNextCursor,
  canReview = false,
  compact = false,
}: {
  facebookPageId: string;
  initialItems: ImageHistoryItem[];
  initialNextCursor: string | null;
  canReview?: boolean;
  compact?: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [preview, setPreview] = useState<ImageHistoryItem | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const loadController = useRef<AbortController | null>(null);

  useEffect(() => {
    loadController.current?.abort();
    setItems(initialItems);
    setNextCursor(initialNextCursor);
    setPreview(null);
    setMessage("");
  }, [facebookPageId, initialItems, initialNextCursor]);

  useEffect(() => () => loadController.current?.abort(), []);

  const loadMore = async () => {
    if (!nextCursor) return;
    loadController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;
    setLoadingMore(true);
    setMessage("");
    try {
      const params = new URLSearchParams({ facebookPageId, take: "24", cursor: nextCursor });
      const response = await fetch(`/api/images/history?${params.toString()}`, { signal: controller.signal });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error ?? "Không tải thêm được hình ảnh");
        return;
      }
      setItems((current) => {
        const knownIds = new Set(current.map((item) => item.id));
        return [...current, ...(data.data as ImageHistoryItem[]).filter((item) => !knownIds.has(item.id))];
      });
      setNextCursor(data.pagination?.nextCursor ?? null);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage("Không tải thêm được hình ảnh");
    } finally {
      if (loadController.current === controller) {
        loadController.current = null;
        setLoadingMore(false);
      }
    }
  };

  const sendFeedback = async (item: ImageHistoryItem, rating: "right_style" | "off_brand") => {
    setFeedbackLoading(`${item.id}:${rating}`);
    setMessage("");
    try {
      const response = await fetch("/api/images/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generationId: item.id, rating }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error ?? "Không lưu được đánh giá");
        return;
      }
      const accepted = Boolean(data.data?.accepted);
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, userAccepted: accepted } : entry));
      setPreview((current) => current?.id === item.id ? { ...current, userAccepted: accepted } : current);
      setMessage(accepted ? "Đã duyệt hình ảnh." : "Đã đánh dấu hình ảnh cần chỉnh sửa.");
    } catch {
      setMessage("Không lưu được đánh giá");
    } finally {
      setFeedbackLoading(null);
    }
  };

  if (items.length === 0) {
    return <EmptyState title="Chưa có hình ảnh" description="Các hình ảnh được tạo cho Facebook Page này sẽ xuất hiện tại đây." />;
  }

  return (
    <div className="space-y-4">
      {message && <p role="status" aria-live="polite" className="rounded-md border border-[var(--border)] bg-[var(--bg-subtle)] p-3 text-xs text-[var(--text-secondary)]">{message}</p>}
      <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${compact ? "lg:grid-cols-4" : "lg:grid-cols-3 xl:grid-cols-4"}`}>
        {items.map((item) => (
          <MediaAssetCard
            key={item.id}
            title={item.visualBrief || item.prompt || "Ảnh đã tạo"}
            description={item.prompt}
            thumbnailUrl={item.thumbnailUrl}
            aspectRatio={item.format}
            badges={<MediaStatusBadge status={imageReviewStatus(item.userAccepted, item.generationStatus)} />}
            metadata={(
              <>
                <span>{item.format}</span>
                <span>{item.visionScore ?? item.qualityScore}/100</span>
                <span>{formatDate(item.createdAt)}</span>
                {item.postId && <span>Đã gắn vào bài</span>}
              </>
            )}
            onSelect={() => setPreview(item)}
          />
        ))}
      </div>

      {!compact && nextCursor && (
        <div className="flex justify-center">
          <Button variant="secondary" loading={loadingMore} onClick={loadMore}>Tải thêm hình ảnh</Button>
        </div>
      )}

      <MediaPreviewDialog
        open={Boolean(preview)}
        onOpenChange={(open) => { if (!open) setPreview(null); }}
        title={preview?.visualBrief || "Ảnh đã tạo"}
        description={preview?.prompt}
        mediaUrl={preview?.imageUrl}
        aspectRatio={preview?.format}
        details={preview ? (
          <div className="space-y-3 text-sm">
            <MediaStatusBadge status={imageReviewStatus(preview.userAccepted, preview.generationStatus)} />
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between gap-3"><dt className="text-[var(--text-muted)]">Định dạng</dt><dd>{preview.format}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-[var(--text-muted)]">Model</dt><dd>{preview.model || "Không rõ"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-[var(--text-muted)]">Chất lượng</dt><dd>{preview.visionScore ?? preview.qualityScore}/100</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-[var(--text-muted)]">Ngày tạo</dt><dd>{formatDateTime(preview.createdAt)}</dd></div>
            </dl>
          </div>
        ) : null}
        actions={preview ? (
          <>
            <a href={preview.imageUrl} download className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-4 text-sm font-semibold text-[var(--text)]">
              <DownloadSimple size={14} /> Tải ảnh
            </a>
            {canReview && (
              <>
                <Button size="sm" variant="secondary" loading={feedbackLoading === `${preview.id}:right_style`} onClick={() => sendFeedback(preview, "right_style")}>
                  <ThumbsUp size={13} weight="fill" /> Duyệt ảnh
                </Button>
                <Button size="sm" variant="secondary" loading={feedbackLoading === `${preview.id}:off_brand`} onClick={() => sendFeedback(preview, "off_brand")}>
                  <ThumbsDown size={13} /> Cần chỉnh
                </Button>
              </>
            )}
          </>
        ) : null}
      />
    </div>
  );
}
