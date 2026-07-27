"use client";

/**
 * The evidence layer of the ideas workspace: the opportunity score with its
 * breakdown, the channel suggestion, and the measured benchmark.
 *
 * Every number rendered here arrives already computed from a stored column
 * (idea-score.ts, channel-fit.ts, content-benchmark.ts). These components add no
 * arithmetic of their own, and a factor with no data is rendered as "chưa có dữ
 * liệu" rather than as a zero that would read like a measurement.
 */

import { CheckCircle, MinusCircle, Target, TrendUp } from "@phosphor-icons/react";
import { suggestChannels, type ChannelSuggestion } from "@/lib/channel-fit";
import type { ContentBenchmark } from "@/lib/content-benchmark";
import { benchmarkFor, MIN_BENCHMARK_SAMPLES } from "@/lib/content-benchmark";
import { PLATFORM_LABELS, POST_TYPE_LABELS, TONE_LABELS, label } from "@/lib/creative-labels";
import { scoreBand, type IdeaScore } from "@/lib/idea-score";

const BAND_TONE: Record<ReturnType<typeof scoreBand>, { chip: string; text: string }> = {
  high: { chip: "bg-[var(--green-light)] text-[var(--green)]", text: "Đáng làm sớm" },
  medium: { chip: "bg-[var(--amber-light)] text-[var(--amber)]", text: "Cân nhắc" },
  low: { chip: "bg-[var(--bg-subtle)] text-[var(--text-muted)]", text: "Bằng chứng yếu" },
};

/** Compact score chip for list rows. */
export function ScoreChip({ score }: { score: IdeaScore }) {
  const tone = BAND_TONE[scoreBand(score.score)];
  return (
    <span
      className={`chip-tone inline-flex shrink-0 items-center gap-1 rounded-[6px] px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${tone.chip}`}
      title={`Điểm cơ hội ${score.score}/100${score.preliminary ? " · tạm tính, chưa đo được đà tăng" : ""}`}
    >
      {score.score}
      {score.preliminary && <span className="font-semibold opacity-70">tạm</span>}
    </span>
  );
}

/** The score with its full per-factor audit trail. */
export function ScoreBreakdown({ score }: { score: IdeaScore }) {
  const band = scoreBand(score.score);
  const tone = BAND_TONE[band];
  const missing = score.breakdown.filter((entry) => !entry.hasData).length;

  return (
    <div className="rounded-[12px] border border-[var(--border)] p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[30px] font-extrabold leading-none tabular-nums tracking-tight">{score.score}</span>
        <span className="text-[13px] font-semibold text-[var(--text-muted)]">/ 100</span>
        <span className={`rounded-[6px] px-2 py-0.5 text-[11px] font-bold ${tone.chip}`}>{tone.text}</span>
      </div>

      <p className="mt-2 text-[12px] leading-relaxed text-[var(--text-muted)]">
        {score.preliminary
          ? "Tạm tính: chưa có mẫu đo trước nên chưa tính được đà tăng. Điểm sẽ tăng sau lần đồng bộ tiếp theo."
          : "Tổng của 5 yếu tố dưới đây, tất cả lấy từ số đã lưu."}
        {missing > 0 && ` ${missing}/5 yếu tố chưa có dữ liệu nên không được cộng điểm.`}
      </p>

      <ul className="mt-3 space-y-2.5">
        {score.breakdown.map((entry) => (
          <li key={entry.factor}>
            <div className="flex items-baseline justify-between gap-2">
              <span className={`text-[12.5px] font-semibold ${entry.hasData ? "" : "text-[var(--text-muted)]"}`}>
                {entry.hasData
                  ? <CheckCircle size={13} weight="fill" className="mr-1 inline align-[-2px] text-[var(--text-muted)]" aria-hidden="true" />
                  : <MinusCircle size={13} className="mr-1 inline align-[-2px] text-[var(--text-muted)]" aria-hidden="true" />}
                {entry.label}
              </span>
              <span className="shrink-0 text-[12px] font-bold tabular-nums text-[var(--text-secondary)]">
                {entry.hasData ? `${entry.points}/${entry.maxPoints}` : "—"}
              </span>
            </div>
            {/* Neutral fill on purpose: the bar shows how full ONE factor is, so it
                must not borrow the overall band's colour and read as a verdict. */}
            <div className="mt-1 h-[3px] overflow-hidden rounded-full bg-[var(--bg-subtle)]">
              <div
                className="h-full rounded-full bg-[var(--accent)]"
                style={{ width: `${entry.maxPoints > 0 ? (entry.points / entry.maxPoints) * 100 : 0}%` }}
              />
            </div>
            <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--text-muted)]">{entry.detail}</p>
          </li>
        ))}
      </ul>

      <p className="mt-3 border-t border-[var(--border)] pt-2.5 text-[11px] leading-relaxed text-[var(--text-muted)]">
        Điểm không dùng chỉ số lượt tìm/lượt quảng cáo thô, vì hai nguồn đo bằng đơn vị khác nhau nên không so được với nhau.
      </p>
    </div>
  );
}

const FIT_TONE: Record<ChannelSuggestion["lengthFit"], string> = {
  ideal: "text-[var(--green)]",
  ok: "text-[var(--text-secondary)]",
  too_short: "text-[var(--amber)]",
  too_long: "text-[var(--amber)]",
};

/** Ranked channels for a draft. Only connected channels ever appear. */
export function ChannelSuggestions({
  connected,
  wordCount,
  history,
  targetChannels,
}: {
  connected: string[];
  wordCount: number;
  history: Array<{ platform: string; avgEngagement: number; sampleCount: number }>;
  targetChannels: string[];
}) {
  const rows = suggestChannels({ connected, wordCount, history, targetChannels });

  if (rows.length === 0) {
    return (
      <p className="mt-2 rounded-[10px] bg-[var(--bg-subtle)] p-3 text-[12px] leading-relaxed text-[var(--text-muted)]">
        Chưa kết nối kênh nào nên chưa gợi ý được. Kết nối Trang Facebook, Zalo OA hoặc TikTok ở phần cấu hình.
      </p>
    );
  }

  return (
    <ol className="mt-2.5 space-y-1.5">
      {rows.map((row) => (
        <li key={row.channel} className="flex items-start gap-2.5 rounded-[10px] border border-[var(--border)] p-2.5">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] bg-[var(--bg-subtle)] text-[11.5px] font-bold tabular-nums text-[var(--text-secondary)]">
            {row.rank}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-[13px] font-bold">{label(PLATFORM_LABELS, row.channel)}</span>
              {row.targeted && (
                <span className="rounded-[5px] bg-[var(--accent-light)] px-1.5 py-0.5 text-[10.5px] font-bold text-[var(--accent)]">
                  Đã chọn
                </span>
              )}
              {row.measuredEngagement !== null && (
                <span className="inline-flex items-center gap-1 rounded-[5px] bg-[var(--green-light)] px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums text-[var(--green)]">
                  <TrendUp size={10} weight="bold" aria-hidden="true" />
                  {row.measuredEngagement.toFixed(1)} tương tác/bài
                </span>
              )}
            </span>
            <span className="mt-1 block text-[11.5px] leading-relaxed text-[var(--text-muted)]">
              {row.reasons[0]}
              {row.reasons[1] && (
                <>
                  {" · "}
                  <span className={FIT_TONE[row.lengthFit]}>{row.reasons[1]}</span>
                </>
              )}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * What similar published posts actually achieved. This is a description of the
 * past, not a forecast — the copy says so, and nothing is shown when fewer than
 * MIN_BENCHMARK_SAMPLES posts back the average.
 */
export function MeasuredBenchmark({
  benchmarks,
  postType,
  channels,
}: {
  benchmarks: ContentBenchmark[];
  postType: string;
  channels: string[];
}) {
  const matched = channels
    .map((channel) => benchmarkFor(benchmarks, postType, channel))
    .filter((row): row is ContentBenchmark => row !== null);

  if (matched.length === 0) {
    return (
      <p className="mt-2 rounded-[10px] bg-[var(--bg-subtle)] p-3 text-[12px] leading-relaxed text-[var(--text-muted)]">
        Chưa đủ dữ liệu: cần ít nhất {MIN_BENCHMARK_SAMPLES} bài <b className="text-[var(--text-secondary)]">{label(POST_TYPE_LABELS, postType)}</b>{" "}
        đã đăng trên cùng kênh mới có mức tương tác để so sánh. App không dự đoán con số cho bài chưa đăng.
      </p>
    );
  }

  return (
    <>
      <ul className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
        {matched.map((row) => (
          <li key={`${row.postType}-${row.platform}`} className="rounded-[10px] border border-[var(--border)] p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--text-muted)]">
              <Target size={13} aria-hidden="true" />
              {label(PLATFORM_LABELS, row.platform)}
            </p>
            <p className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-[22px] font-extrabold leading-none tabular-nums tracking-tight">
                {row.avgEngagement.toFixed(1)}
              </span>
              <span className="text-[11.5px] text-[var(--text-muted)]">tương tác/bài</span>
            </p>
            <p className="mt-1 text-[11.5px] text-[var(--text-muted)]">
              Trung bình {row.sampleCount} bài <b className="text-[var(--text-secondary)]">{label(POST_TYPE_LABELS, row.postType)}</b> đã đăng
            </p>
            {row.bestTone && (
              <p className="mt-1.5 border-t border-[var(--border)] pt-1.5 text-[11.5px] text-[var(--text-muted)]">
                Giọng hiệu quả nhất: <b className="text-[var(--text-secondary)]">{label(TONE_LABELS, row.bestTone.tone)}</b>{" "}
                <span className="tabular-nums">({row.bestTone.avgEngagement.toFixed(1)} · {row.bestTone.sampleCount} bài)</span>
              </p>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-muted)]">
        Đây là số đã đo của bài đã đăng, không phải dự đoán cho bản nháp này. Số liệu tính trên toàn tài khoản.
      </p>
    </>
  );
}
