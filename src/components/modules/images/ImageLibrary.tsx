"use client";

import { useEffect, useRef, useState } from "react";
import { DownloadSimple, Image as ImageIcon, ThumbsDown, ThumbsUp } from "@phosphor-icons/react";
import { MediaAssetCard } from "@/components/media/MediaAssetCard";
import { MediaPreviewDialog } from "@/components/media/MediaPreviewDialog";
import { MediaStatusBadge } from "@/components/media/MediaStatusBadge";
import { IMAGE_FORMAT_LABELS, IMAGE_PRESET_LABELS, label } from "@/lib/creative-labels";
import type { ImageHistoryItem } from "@/lib/image-history";
import { imageReviewStatus } from "@/lib/media-gallery";
import { formatDate, formatDateTime } from "@/lib/utils";

/**
 * `visionScore` comes from the image-vision pass and `qualityScore` from the
 * prompt-side heuristic. They are different measurements, so the UI says which
 * one it is showing instead of collapsing them into an unlabelled number.
 *
 * `ImageGeneration.qualityScore` is `Int @default(0)`, so a stored 0 cannot be
 * told apart from "never scored" — it is treated as absent rather than shown as
 * "0/100", which would read as a measured verdict. `visionScore` is nullable, so
 * a genuine 0 there is kept.
 */
function scoreOf(item: ImageHistoryItem) {
  if (item.visionScore !== null && item.visionScore !== undefined) {
    return { value: item.visionScore, source: "Ảnh đã chấm" };
  }
  if (item.qualityScore) {
    return { value: item.qualityScore, source: "Chấm theo prompt" };
  }
  return null;
}

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
      setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, userAccepted: accepted } : entry)));
      setPreview((current) => (current?.id === item.id ? { ...current, userAccepted: accepted } : current));
      setMessage(accepted ? "Đã duyệt hình ảnh." : "Đã đánh dấu hình ảnh cần chỉnh sửa.");
    } catch {
      setMessage("Không lưu được đánh giá");
    } finally {
      setFeedbackLoading(null);
    }
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-card)] py-14 text-center">
        <ImageIcon size={28} className="text-[var(--text-muted)]" aria-hidden="true" />
        <p className="text-[13.5px] font-semibold">Chưa có hình ảnh</p>
        <p className="max-w-sm text-[12.5px] text-[var(--text-muted)]">
          Ảnh tạo cho Trang này sẽ xuất hiện ở đây kèm điểm chấm và trạng thái duyệt.
        </p>
      </div>
    );
  }

  const previewScore = preview ? scoreOf(preview) : null;

  return (
    <div className="space-y-4">
      {message && (
        <p
          role="status"
          aria-live="polite"
          className="rounded-[9px] border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2 text-[12.5px] font-semibold text-[var(--text-secondary)]"
        >
          {message}
        </p>
      )}

      <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${compact ? "lg:grid-cols-4" : "lg:grid-cols-3 xl:grid-cols-4"}`}>
        {items.map((item) => {
          const score = scoreOf(item);
          return (
            <MediaAssetCard
              key={item.id}
              title={item.visualBrief || item.prompt || "Ảnh đã tạo"}
              description={item.prompt}
              thumbnailUrl={item.thumbnailUrl}
              aspectRatio={item.format}
              badges={<MediaStatusBadge status={imageReviewStatus(item.userAccepted, item.generationStatus)} />}
              metadata={(
                <>
                  <span>{label(IMAGE_FORMAT_LABELS, item.format)}</span>
                  {score ? <span title={score.source}>{score.value}/100</span> : <span>Chưa chấm điểm</span>}
                  <span>{formatDate(item.createdAt)}</span>
                  {item.postId && <span className="font-bold text-[var(--accent)]">Đã gắn vào bài</span>}
                </>
              )}
              onSelect={() => setPreview(item)}
            />
          );
        })}
      </div>

      {!compact && nextCursor && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            aria-busy={loadingMore}
            className="flex min-h-11 items-center rounded-[9px] border border-[var(--border-strong)] px-4 text-[13px] font-bold text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loadingMore ? "Đang tải…" : "Tải thêm hình ảnh"}
          </button>
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
          <div className="space-y-3">
            <MediaStatusBadge status={imageReviewStatus(preview.userAccepted, preview.generationStatus)} />
            <dl className="space-y-2 text-[12.5px]">
              <Row term="Định dạng" value={label(IMAGE_FORMAT_LABELS, preview.format)} />
              {preview.preset && <Row term="Kiểu ảnh" value={label(IMAGE_PRESET_LABELS, preview.preset)} />}
              <Row term="Model" value={preview.model || "Không lưu"} />
              <Row
                term={previewScore ? previewScore.source : "Điểm"}
                value={previewScore ? `${previewScore.value}/100` : "Chưa chấm"}
              />
              <Row term="Ngày tạo" value={formatDateTime(preview.createdAt)} />
            </dl>
          </div>
        ) : null}
        actions={preview ? (
          <>
            <a
              href={preview.imageUrl}
              download
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[9px] border border-[var(--border-strong)] px-4 text-[13px] font-bold text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              <DownloadSimple size={15} aria-hidden="true" />Tải ảnh
            </a>
            {canReview && (
              <>
                <button
                  type="button"
                  onClick={() => sendFeedback(preview, "right_style")}
                  disabled={feedbackLoading === `${preview.id}:right_style`}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-[9px] bg-[var(--green-light)] px-3 text-[13px] font-bold text-[var(--green)] transition-opacity hover:opacity-80 disabled:opacity-50"
                >
                  <ThumbsUp size={15} weight="fill" aria-hidden="true" />Duyệt ảnh
                </button>
                <button
                  type="button"
                  onClick={() => sendFeedback(preview, "off_brand")}
                  disabled={feedbackLoading === `${preview.id}:off_brand`}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-[9px] bg-[var(--amber-light)] px-3 text-[13px] font-bold text-[var(--amber)] transition-opacity hover:opacity-80 disabled:opacity-50"
                >
                  <ThumbsDown size={15} aria-hidden="true" />Cần chỉnh
                </button>
              </>
            )}
          </>
        ) : null}
      />
    </div>
  );
}

function Row({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[var(--text-muted)]">{term}</dt>
      <dd className="text-right font-semibold text-[var(--text)]">{value}</dd>
    </div>
  );
}
