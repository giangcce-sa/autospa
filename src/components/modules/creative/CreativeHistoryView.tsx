"use client";

/**
 * "Lịch sử" — a timeline of what the research pipeline actually did, from
 * IntelligenceSignal, ContentGeneration, Post and JobRun.
 *
 * The one thing it deliberately does not do is imply causality. The app never
 * stored which signal a draft came from, so a sync and a draft that appear next
 * to each other are two facts in time order, never "this sync produced that
 * draft". The footnote says so.
 */

import Link from "next/link";
import {
  ArrowsClockwise,
  ClockCounterClockwise,
  NotePencil,
  Sparkle,
  Timer,
  Warning,
} from "@phosphor-icons/react";
import type { CreativeHistoryData } from "@/lib/creative-history";
import { POST_STATUS_LABELS, SIGNAL_SOURCE_LABELS, label } from "@/lib/creative-labels";
import type { HistoryKind } from "@/lib/research-history";

const KIND_META: Record<HistoryKind, { icon: typeof Sparkle; tone: string; label: string }> = {
  sync: { icon: ArrowsClockwise, tone: "bg-[var(--blue-light)] text-[var(--blue)]", label: "Đồng bộ" },
  generation: { icon: Sparkle, tone: "bg-[var(--purple-light)] text-[var(--purple)]", label: "Sinh nội dung" },
  draft: { icon: NotePencil, tone: "bg-[var(--accent-light)] text-[var(--accent)]", label: "Bản nháp" },
  job: { icon: Timer, tone: "bg-[var(--amber-light)] text-[var(--amber)]", label: "Cron" },
};

const JOB_LABELS: Record<string, string> = {
  daily_report: "Báo cáo hằng ngày",
  auto_publish: "Tự động đăng bài",
  realtime_monitor: "Giám sát realtime",
};

function stamp(iso: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(iso));
}

function relative(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.round(hours / 24)} ngày trước`;
}

export function CreativeHistoryView({
  data,
  facebookPageId,
}: {
  data: CreativeHistoryData;
  facebookPageId: string;
}) {
  const { stats } = data;

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,19rem)]">
      <section className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-sm)]">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="flex items-center gap-2 text-[16px] font-extrabold tracking-tight">
            <ClockCounterClockwise size={18} weight="bold" className="text-[var(--accent)]" aria-hidden="true" />
            Dòng thời gian
          </h2>
          <span className="text-[11.5px] text-[var(--text-muted)]">{stats.lookbackDays} ngày gần nhất</span>
        </div>

        {data.timeline.length === 0 ? (
          <p className="mt-4 rounded-[10px] bg-[var(--bg-subtle)] p-3 text-[12.5px] leading-relaxed text-[var(--text-muted)]">
            {data.includeAccountRuns
              ? "Chưa có lần đồng bộ, sinh nội dung hay bản nháp nào trong khoảng thời gian này."
              : "Tài khoản của bạn chỉ xem được hoạt động của Trang này. Lịch sử đồng bộ và cron ở phạm vi tài khoản cần quyền chủ sở hữu."}
          </p>
        ) : (
          <ol className="mt-4 space-y-0">
            {data.timeline.map((entry, index) => {
              const meta = KIND_META[entry.kind];
              const Icon = meta.icon;
              const last = index === data.timeline.length - 1;
              const title = entry.kind === "job" ? (JOB_LABELS[entry.title] ?? entry.title) : entry.title;
              return (
                <li key={entry.key} className="relative flex gap-3 pb-4">
                  {!last && <span className="absolute left-[15px] top-9 h-full w-px bg-[var(--border)]" aria-hidden="true" />}
                  <span className={`chip-tone relative z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] ${meta.tone}`}>
                    <Icon size={15} weight="bold" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-[13px] font-bold">{title}</span>
                      {/* Drafts and cron runs carry a status chip instead. */}
                      {(entry.kind === "sync" || entry.kind === "generation") && (
                        <span className="rounded-[5px] bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[10.5px] font-bold text-[var(--text-secondary)]">
                          {meta.label}
                        </span>
                      )}
                      {entry.status && <StatusChip kind={entry.kind} status={entry.status} />}
                      <span className="text-[11px] tabular-nums text-[var(--text-muted)]">
                        {stamp(entry.at)} · {relative(entry.at)}
                      </span>
                    </div>
                    {entry.detail && (
                      <p className="mt-0.5 truncate text-[12px] text-[var(--text-muted)]" title={entry.detail}>
                        {entry.detail}
                      </p>
                    )}
                    {entry.error && (
                      <p className="mt-1 flex items-start gap-1.5 rounded-[8px] bg-[var(--danger-light)] px-2 py-1 text-[11.5px] font-semibold text-[var(--danger)]">
                        <Warning size={13} weight="fill" className="mt-px shrink-0" aria-hidden="true" />
                        {entry.error}
                      </p>
                    )}
                    {entry.postId && (
                      <Link
                        href={`/creative/content?view=editor&scope=current&pageId=${facebookPageId}&id=${entry.postId}`}
                        className="mt-1 inline-block text-[11.5px] font-bold text-[var(--accent)] transition-opacity hover:opacity-70"
                      >
                        Mở bài
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <p className="mt-2 border-t border-[var(--border)] pt-3 text-[11px] leading-relaxed text-[var(--text-muted)]">
          Đây là các mốc đã lưu, xếp theo thời gian. App chưa lưu bản nháp nào sinh ra từ tín hiệu nào, nên hai mốc cạnh
          nhau không có nghĩa là mốc trên tạo ra mốc dưới.
        </p>
      </section>

      <aside className="space-y-4">
        <section className="surface-hover rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-card)] p-[18px] shadow-[var(--shadow-sm)]">
          <h3 className="text-[14px] font-bold">Trong {stats.lookbackDays} ngày</h3>
          <dl className="mt-2.5 space-y-1.5 text-[12.5px]">
            <Stat term="Lần đồng bộ" value={stats.syncRuns} />
            <Stat term="Chủ đề thu được" value={stats.topicsCollected} />
            <Stat term="Lần sinh nội dung" value={stats.generations} />
            <Stat term="Bản nháp nghiên cứu" value={stats.researchDrafts} />
            <Stat term="Cron lỗi" value={stats.failedJobs} danger={stats.failedJobs > 0} />
          </dl>
          <p className="mt-2.5 border-t border-[var(--border)] pt-2.5 text-[11px] leading-relaxed text-[var(--text-muted)]">
            Số lần đồng bộ được dựng lại từ mốc thời gian của tín hiệu, nên hai lần chạy cách nhau dưới 2 phút sẽ tính là một.
          </p>
        </section>

        <section className="surface-hover rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-card)] p-[18px] shadow-[var(--shadow-sm)]">
          <h3 className="text-[14px] font-bold">Nguồn nghiên cứu</h3>
          {data.sources.length > 0 ? (
            <ul className="mt-2.5 space-y-2">
              {data.sources.map((source) => (
                <li key={source.source} className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] font-semibold">{label(SIGNAL_SOURCE_LABELS, source.source)}</span>
                    <span className="text-[11px] text-[var(--text-muted)]">Lần cuối {relative(source.lastRunAt)}</span>
                  </span>
                  <span className="shrink-0 text-[12px] font-bold tabular-nums text-[var(--text-secondary)]">
                    {source.runs} lần
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[12.5px] text-[var(--text-muted)]">Chưa có nguồn nào đồng bộ trong khoảng này.</p>
          )}
        </section>
      </aside>
    </div>
  );
}

/** JobRun.status is a raw enum-ish string, so it needs its own Vietnamese map. */
const RUN_STATUS_LABELS: Record<string, string> = {
  success: "Thành công",
  completed: "Hoàn tất",
  running: "Đang chạy",
  failed: "Lỗi",
  error: "Lỗi",
  skipped: "Bỏ qua",
};

function StatusChip({ kind, status }: { kind: HistoryKind; status: string }) {
  const failed = status === "failed" || status === "error";
  const running = status === "running";
  const text = kind === "draft" ? label(POST_STATUS_LABELS, status) : label(RUN_STATUS_LABELS, status);
  const tone = failed
    ? "bg-[var(--danger-light)] text-[var(--danger)]"
    : running
      ? "bg-[var(--amber-light)] text-[var(--amber)]"
      : "bg-[var(--bg-subtle)] text-[var(--text-secondary)]";
  return <span className={`rounded-[5px] px-1.5 py-0.5 text-[10.5px] font-bold ${tone}`}>{text}</span>;
}

function Stat({ term, value, danger }: { term: string; value: number; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-[var(--text-secondary)]">{term}</dt>
      <dd className={`shrink-0 font-bold tabular-nums ${danger ? "text-[var(--danger)]" : "text-[var(--text)]"}`}>{value}</dd>
    </div>
  );
}
