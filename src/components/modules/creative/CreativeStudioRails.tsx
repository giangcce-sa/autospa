import Link from "next/link";
import {
  CONSENT_STATUS_LABELS,
  IMAGE_FORMAT_LABELS,
  IMAGE_PRESET_LABELS,
  JOB_STATUS_LABELS,
  label,
  PLATFORM_LABELS,
  POST_STATUS_LABELS,
  REVIEW_STATUS_LABELS,
} from "@/lib/creative-labels";
import type { ContentStudioData, ImageStudioData, PublishingStudioData, VideoStudioSummary } from "@/lib/creative-studio";
import { StatRows, StudioBars, StudioEmpty, StudioPanel, StudioTag } from "./StudioPrimitives";

/**
 * Context rails for the four non-ideas Sáng tạo studios. Every figure is a
 * stored count/average; nothing here is estimated or forecast.
 */

function clockTime(iso: string) {
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(iso));
}

function scoreTone(value: number | null) {
  if (value === null) return "muted" as const;
  if (value >= 80) return "green" as const;
  if (value >= 60) return "amber" as const;
  return "danger" as const;
}

/* ── Biên tập nội dung ─────────────────────────────────── */

export function ContentStudioRail({ data, pageId }: { data: ContentStudioData; pageId: string }) {
  const scope = `scope=current&pageId=${pageId}`;
  return (
    <div className="space-y-4">
      <StudioPanel title="Trạng thái nội dung" meta={`${data.status.total} bài trong Trang này`}>
        {data.status.total > 0 ? (
          <StudioBars
            total={data.status.total}
            rows={[
              { label: label(POST_STATUS_LABELS, "draft"), count: data.status.draft, tone: "muted" },
              { label: label(POST_STATUS_LABELS, "scheduled"), count: data.status.scheduled, tone: "amber" },
              { label: label(POST_STATUS_LABELS, "published"), count: data.status.published, tone: "green" },
            ]}
          />
        ) : (
          <StudioEmpty text="Chưa có bài nào." />
        )}
      </StudioPanel>

      <StudioPanel
        title="Kiểm duyệt nội dung"
        meta={data.review.total > 0 ? `${data.review.total} bài đã kiểm` : undefined}
        link={{ href: `/creative/content?view=review&${scope}`, label: "Kiểm tra" }}
      >
        {data.review.total > 0 ? (
          <StatRows
            rows={[
              { label: label(REVIEW_STATUS_LABELS, "pass"), value: String(data.review.pass), tone: "green" },
              { label: label(REVIEW_STATUS_LABELS, "warn"), value: String(data.review.warn), tone: "amber" },
              { label: label(REVIEW_STATUS_LABELS, "fail"), value: String(data.review.fail), tone: "danger" },
            ]}
          />
        ) : (
          <StudioEmpty text="Chưa có bài nào qua kiểm duyệt." />
        )}
      </StudioPanel>

      <StudioPanel title="Điểm đã đo">
        <StatRows
          rows={[
            {
              label: `Chất lượng bài (${data.quality.scored} bài)`,
              value: data.quality.avg === null ? "chưa có" : `${data.quality.avg}/100`,
              tone: scoreTone(data.quality.avg),
            },
            {
              label: `Văn phong AI (${data.humanScore.total} lần tạo)`,
              value: data.humanScore.avg === null ? "chưa có" : `${data.humanScore.avg}/100`,
              tone: scoreTone(data.humanScore.avg),
            },
          ]}
        />
      </StudioPanel>

      <StudioPanel title="Lần tạo gần đây">
        {data.generations.length > 0 ? (
          <ul className="space-y-1">
            {data.generations.map((generation) => (
              <li key={generation.id} className="row-hover -mx-1.5 flex items-center gap-2 rounded-[9px] px-1.5 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-semibold">
                    {generation.mode === "quick" ? "Tạo nhanh" : generation.mode} · {generation.narrator}
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)]">{clockTime(generation.createdAt)}</span>
                </span>
                <StudioTag
                  label={`${generation.humanScore}/100`}
                  tone={generation.humanScore >= 80 ? "green" : generation.humanScore >= 60 ? "amber" : "danger"}
                />
              </li>
            ))}
          </ul>
        ) : (
          <StudioEmpty text="Chưa có lần tạo nội dung nào." />
        )}
      </StudioPanel>
    </div>
  );
}

/* ── Xưởng hình ảnh ────────────────────────────────────── */

export function ImageStudioRail({ data, pageId }: { data: ImageStudioData; pageId: string }) {
  const scope = `scope=current&pageId=${pageId}`;
  const presetTotal = data.presets.reduce((sum, row) => sum + row.count, 0);
  return (
    <div className="space-y-4">
      <StudioPanel
        title="Ảnh theo mục đích"
        meta={`${presetTotal} ảnh đã tạo`}
        link={{ href: `/creative/images?view=library&${scope}`, label: "Thư viện" }}
      >
        {data.presets.length > 0 ? (
          <StudioBars
            total={presetTotal}
            rows={data.presets.slice(0, 6).map((row, index) => ({
              label: label(IMAGE_PRESET_LABELS, row.preset),
              count: row.count,
              tone: (["purple", "blue", "rose", "green", "amber", "muted"] as const)[index],
            }))}
          />
        ) : (
          <StudioEmpty text="Chưa có ảnh nào." />
        )}
      </StudioPanel>

      <StudioPanel title="Duyệt ảnh" link={{ href: `/creative/images?view=review&${scope}`, label: "Duyệt" }}>
        <StatRows
          rows={[
            { label: "Đã chấp nhận", value: String(data.accepted.accepted), tone: "green" },
            { label: "Đã loại", value: String(data.accepted.rejected), tone: "danger" },
            { label: "Chưa đánh giá", value: String(data.accepted.pending), tone: "muted" },
          ]}
        />
      </StudioPanel>

      <StudioPanel title="Điểm & chi phí đã ghi nhận" meta={`${data.scores.total} lần sinh ảnh`}>
        <StatRows
          rows={[
            { label: "Điểm chất lượng", value: data.scores.quality === null ? "chưa có" : `${data.scores.quality}/100`, tone: scoreTone(data.scores.quality) },
            { label: "Điểm vision", value: data.scores.vision === null ? "chưa có" : `${data.scores.vision}/100`, tone: scoreTone(data.scores.vision) },
            { label: "Thời gian sinh", value: data.scores.latencyMs === null ? "chưa có" : `${(data.scores.latencyMs / 1000).toFixed(1)}s` },
            { label: "Chi phí ước tính", value: data.scores.costUsd > 0 ? `$${data.scores.costUsd.toFixed(2)}` : "chưa ghi nhận" },
          ]}
        />
      </StudioPanel>

      <StudioPanel title="Đồng ý hình ảnh nhân viên" link={{ href: "/staff-visuals", label: "Quản lý" }}>
        <StatRows
          rows={[
            { label: label(CONSENT_STATUS_LABELS, "consented"), value: String(data.consent.consented), tone: "green" },
            { label: label(CONSENT_STATUS_LABELS, "pending"), value: String(data.consent.pending), tone: "amber" },
            { label: label(CONSENT_STATUS_LABELS, "revoked"), value: String(data.consent.revoked), tone: "danger" },
          ]}
        />
      </StudioPanel>

      {data.brand && (
        <StudioPanel title="Bộ nhận diện" link={{ href: "/system/brand-assets", label: "Sửa" }}>
          <div className="flex items-center gap-3">
            <span className="h-7 w-7 shrink-0 rounded-[7px] border border-[var(--border)]" style={{ background: data.brand.primaryColor }} />
            <span className="h-7 w-7 shrink-0 rounded-[7px] border border-[var(--border)]" style={{ background: data.brand.accentColor }} />
            <span className="min-w-0 truncate text-[12.5px] font-semibold">{data.brand.spaName || "Chưa đặt tên"}</span>
          </div>
        </StudioPanel>
      )}

      {data.formats.length > 0 && (
        <StudioPanel title="Khổ ảnh">
          <StatRows rows={data.formats.map((row) => ({ label: label(IMAGE_FORMAT_LABELS, row.format), value: String(row.count) }))} />
        </StudioPanel>
      )}
    </div>
  );
}

/* ── Xưởng video ───────────────────────────────────────── */

export function VideoStudioRail({ data }: { data: VideoStudioSummary }) {
  const minutes = Math.round(data.scenes.durationSec / 6) / 10;
  return (
    <div className="space-y-4">
      <StudioPanel title="Trạng thái dự án" meta={`${data.status.total} dự án`}>
        {data.status.total > 0 ? (
          <StudioBars
            total={data.status.total}
            rows={[
              { label: "Nháp", count: data.status.draft, tone: "muted" },
              { label: "Đang render", count: data.status.rendering, tone: "blue" },
              { label: "Đã render", count: data.status.rendered, tone: "amber" },
              { label: "Đã đăng", count: data.status.published, tone: "green" },
            ]}
          />
        ) : (
          <StudioEmpty text="Chưa có dự án video nào." />
        )}
      </StudioPanel>

      <StudioPanel title="Cần xử lý" meta="Theo revision đã lưu">
        <StatRows
          rows={[
            { label: "Cần render lại", value: String(data.revision.needsRender), tone: data.revision.needsRender > 0 ? "amber" : "muted" },
            { label: "Chờ phê duyệt", value: String(data.revision.needsApproval), tone: data.revision.needsApproval > 0 ? "blue" : "muted" },
            { label: "Đã sẵn sàng", value: String(data.revision.ready), tone: "green" },
          ]}
        />
      </StudioPanel>

      <StudioPanel title="Cảnh & thời lượng">
        <StatRows
          rows={[
            { label: "Tổng số cảnh", value: String(data.scenes.count) },
            { label: "Tổng thời lượng", value: data.scenes.durationSec > 0 ? `${minutes} phút` : "chưa có" },
          ]}
        />
      </StudioPanel>

      <StudioPanel title="Tác vụ render" meta={data.jobs.total > 0 ? `${data.jobs.total} job` : undefined}>
        {data.jobs.total > 0 ? (
          <StatRows
            rows={[
              { label: label(JOB_STATUS_LABELS, "running"), value: String(data.jobs.running), tone: "blue" },
              { label: label(JOB_STATUS_LABELS, "queued"), value: String(data.jobs.queued), tone: "amber" },
              { label: label(JOB_STATUS_LABELS, "failed"), value: String(data.jobs.failed), tone: data.jobs.failed > 0 ? "danger" : "muted" },
              { label: label(JOB_STATUS_LABELS, "completed"), value: String(data.jobs.completed), tone: "green" },
            ]}
          />
        ) : (
          <StudioEmpty text="Chưa có job nào." />
        )}
      </StudioPanel>

      <StudioPanel title="Đồng ý hình ảnh / giọng">
        <StatRows
          rows={[
            { label: label(CONSENT_STATUS_LABELS, "granted"), value: String(data.consent.granted), tone: "green" },
            { label: label(CONSENT_STATUS_LABELS, "pending"), value: String(data.consent.pending), tone: "amber" },
            { label: label(CONSENT_STATUS_LABELS, "revoked"), value: String(data.consent.revoked), tone: "danger" },
          ]}
        />
      </StudioPanel>

      {data.performance.length > 0 && (
        <StudioPanel title="Hiệu suất đã đo">
          <ul className="space-y-1">
            {data.performance.map((row, index) => (
              <li key={`${row.projectId}-${index}`} className="flex items-center justify-between gap-2 text-[12.5px]">
                <span className="truncate text-[var(--text-secondary)]">{label(PLATFORM_LABELS, row.platform)}</span>
                <span className="shrink-0 font-bold tabular-nums">
                  {row.views.toLocaleString("vi-VN")} view
                  {row.completionRate > 0 && <span className="ml-1.5 font-medium text-[var(--text-muted)]">{Math.round(row.completionRate * 100)}%</span>}
                </span>
              </li>
            ))}
          </ul>
        </StudioPanel>
      )}
    </div>
  );
}

/* ── Đăng bài & Thư viện ───────────────────────────────── */

export function PublishingStudioRail({ data, pageId }: { data: PublishingStudioData; pageId: string }) {
  const scope = `scope=current&pageId=${pageId}`;
  return (
    <div className="space-y-4">
      <StudioPanel title="Lịch hôm nay" meta={data.overdue > 0 ? `${data.overdue} bài quá hạn` : undefined} link={{ href: `/creative/publishing?view=calendar&${scope}`, label: "Lịch" }}>
        {data.scheduledToday.length > 0 ? (
          <ul>
            {data.scheduledToday.map((row) => (
              <li key={row.id} className="row-hover -mx-1.5 flex items-center gap-2.5 rounded-[9px] px-1.5 py-2">
                <span className="w-10 shrink-0 text-[12.5px] font-bold tabular-nums text-[var(--text-secondary)]">{clockTime(row.scheduledAt)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-semibold">{row.caption.split("\n")[0]}</span>
                  <span className="text-[11px] text-[var(--text-muted)]">{label(PLATFORM_LABELS, row.platform)}</span>
                </span>
                <StudioTag
                  label={label(POST_STATUS_LABELS, row.status)}
                  tone={row.status === "published" ? "blue" : row.status === "scheduled" ? "green" : "muted"}
                />
              </li>
            ))}
          </ul>
        ) : (
          <StudioEmpty text="Hôm nay chưa có bài nào lên lịch." />
        )}
        {data.overdue > 0 && (
          <Link href={`/creative/publishing?view=library&status=scheduled&${scope}`} className="mt-2 block text-[12px] font-bold text-[var(--danger)] hover:opacity-70">
            {data.overdue} bài đã qua giờ nhưng chưa đăng →
          </Link>
        )}
      </StudioPanel>

      <StudioPanel title="Trạng thái bài" meta={`${data.status.total} bài`}>
        {data.status.total > 0 ? (
          <StudioBars
            total={data.status.total}
            rows={[
              { label: label(POST_STATUS_LABELS, "draft"), count: data.status.draft, tone: "muted" },
              { label: label(POST_STATUS_LABELS, "scheduled"), count: data.status.scheduled, tone: "amber" },
              { label: label(POST_STATUS_LABELS, "published"), count: data.status.published, tone: "green" },
            ]}
          />
        ) : (
          <StudioEmpty text="Chưa có bài nào." />
        )}
      </StudioPanel>

      <StudioPanel title="Hàng đợi đăng">
        <StatRows
          rows={[
            { label: "Đang xử lý", value: String(data.operations.processing), tone: data.operations.processing > 0 ? "blue" : "muted" },
            { label: "Chờ", value: String(data.operations.pending), tone: "amber" },
            { label: "Thành công", value: String(data.operations.succeeded), tone: "green" },
            { label: "Lỗi", value: String(data.operations.failed), tone: data.operations.failed > 0 ? "danger" : "muted" },
            { label: "Cần đối soát", value: String(data.operations.needsReconciliation), tone: data.operations.needsReconciliation > 0 ? "danger" : "muted" },
          ]}
        />
      </StudioPanel>

      <StudioPanel title="Kết quả theo kênh" meta="Đếm theo lần thử, không phải theo bài">
        {data.channels.length > 0 ? (
          <ul className="space-y-2">
            {data.channels.map((row) => (
              <li key={row.channel} className="flex items-center justify-between gap-2 text-[12.5px]">
                <span className="truncate text-[var(--text-secondary)]">{label(PLATFORM_LABELS, row.channel)}</span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <StudioTag label={`${row.succeeded} ok`} tone="green" />
                  {row.failed > 0 && <StudioTag label={`${row.failed} lỗi`} tone="danger" />}
                  {row.other > 0 && <StudioTag label={`${row.other} khác`} tone="muted" />}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <StudioEmpty text="Chưa có lần đăng nào được ghi nhận." />
        )}
      </StudioPanel>
    </div>
  );
}
