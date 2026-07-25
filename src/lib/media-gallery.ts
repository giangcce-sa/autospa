export type MediaStatusTone = "neutral" | "info" | "warning" | "success" | "danger";

export interface MediaStatusPresentation {
  label: string;
  tone: MediaStatusTone;
}

const MEDIA_STATUS: Record<string, MediaStatusPresentation> = {
  draft: { label: "Nháp", tone: "neutral" },
  queued: { label: "Trong hàng đợi", tone: "warning" },
  pending: { label: "Chờ xử lý", tone: "warning" },
  scheduled: { label: "Đã lên lịch", tone: "info" },
  generating: { label: "Đang tạo", tone: "warning" },
  processing: { label: "Đang xử lý", tone: "warning" },
  rendering: { label: "Đang dựng", tone: "warning" },
  completed: { label: "Hoàn tất", tone: "info" },
  ready: { label: "Sẵn sàng", tone: "info" },
  review: { label: "Chờ duyệt", tone: "warning" },
  approved: { label: "Đã duyệt", tone: "success" },
  published: { label: "Đã đăng", tone: "success" },
  partially_published: { label: "Đăng một phần", tone: "warning" },
  publish_failed: { label: "Đăng thất bại", tone: "danger" },
  failed: { label: "Thất bại", tone: "danger" },
  rejected: { label: "Bị từ chối", tone: "danger" },
  stale: { label: "Cần dựng lại", tone: "danger" },
  mock: { label: "Bản thử", tone: "warning" },
};

export function mediaStatusPresentation(status: string): MediaStatusPresentation {
  return MEDIA_STATUS[status] ?? { label: status || "Không rõ", tone: "neutral" };
}

export function imageReviewStatus(userAccepted: boolean | null, generationStatus: string) {
  if (userAccepted === true) return "approved";
  if (userAccepted === false) return "rejected";
  return generationStatus;
}

export function videoRevisionState(inputRevision: number, renderedRevision?: number | null, approvedRevision?: number | null) {
  return {
    renderFresh: renderedRevision != null && renderedRevision === inputRevision,
    approvalFresh: approvedRevision != null && approvedRevision === inputRevision,
  };
}

export function videoPosterUrl(input: {
  thumbnailUrl?: string | null;
  firstSceneImageUrl?: string | null;
  inputRevision: number;
  renderedRevision?: number | null;
}) {
  const renderFresh = input.renderedRevision != null && input.renderedRevision === input.inputRevision;
  if (renderFresh && input.thumbnailUrl && !input.thumbnailUrl.startsWith("mock://")) return input.thumbnailUrl;
  if (input.firstSceneImageUrl && !input.firstSceneImageUrl.startsWith("mock://")) return input.firstSceneImageUrl;
  return null;
}

export function mediaAspectClass(aspectRatio?: string | null) {
  if (aspectRatio === "9:16" || aspectRatio === "story") return "aspect-[9/16]";
  if (aspectRatio === "16:9" || aspectRatio === "cover" || aspectRatio === "thumbnail") return "aspect-video";
  if (aspectRatio === "4:5") return "aspect-[4/5]";
  return "aspect-square";
}
