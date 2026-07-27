"use client";
/* eslint-disable @next/next/no-img-element -- Brand logos are user-configured remote URLs. */

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarBlank,
  ChartLineUp,
  Confetti,
  Files,
  Image as ImageIcon,
  Lightbulb,
  Lightning,
  ListBullets,
  MagnifyingGlass,
  NotePencil,
  Palette,
  Paperclip,
  PaperPlaneTilt,
  Sparkle,
  Storefront,
  Target,
  TrendDown,
  TrendUp,
  VideoCamera,
} from "@phosphor-icons/react";
import { countWords } from "@/lib/channel-fit";
import type { CreativeIdeasData } from "@/lib/creative-ideas";
import {
  briefIsEmpty,
  formatBytes,
  formatDuration,
  formatLabelFromMime,
  type PostBrief,
} from "@/lib/creative-brief";
import { ChannelSuggestions, MeasuredBenchmark, ScoreBreakdown, ScoreChip } from "./IdeaEvidence";
import {
  IMAGE_PRESET_LABELS as PRESET_LABELS,
  label,
  PLATFORM_LABELS,
  POST_TYPE_LABELS,
  SIGNAL_SOURCE_LABELS as SOURCE_LABELS,
  TONE_LABELS,
} from "@/lib/creative-labels";

type DraftAsset = {
  id: string;
  kind: string;
  name: string;
  url: string;
  mimeType: string | null;
  sizeBytes: number | null;
  durationSec: number | null;
};

type Draft = {
  id: string;
  title: string | null;
  summary: string | null;
  brief: PostBrief;
  caption: string;
  hashtags: string | null;
  postType: string;
  tone: string;
  scheduledAt: string | null;
  qualityNotes: string | null;
  createdAt: string;
  assets: DraftAsset[];
};

type FeedKind = "draft" | "trend" | "competitor" | "holiday";

interface FeedItem {
  key: string;
  kind: FeedKind;
  title: string;
  meta: string;
  tags: string[];
  timestamp: string | null;
  draft?: Draft;
  trend?: CreativeIdeasData["trends"][number];
  holiday?: CreativeIdeasData["holidays"][number];
  competitorCount?: number;
}

const FILTERS: Array<{ id: "all" | FeedKind; label: string }> = [
  { id: "all", label: "Tất cả" },
  { id: "draft", label: "Bản nháp" },
  { id: "trend", label: "Xu hướng" },
  { id: "competitor", label: "Đối thủ" },
  { id: "holiday", label: "Dịp lễ" },
];

const STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  draft: { label: "Nháp", tone: "bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border)]" },
  scheduled: { label: "Đã lên lịch", tone: "bg-[var(--green-light)] text-[var(--green)]" },
  published: { label: "Đã đăng", tone: "bg-[var(--blue-light)] text-[var(--blue)]" },
};
function relativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.round(hours / 24);
  return `${days} ngày trước`;
}

function clockTime(iso: string) {
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(iso));
}

function extractTopic(qualityNotes: string | null, caption: string) {
  const topic = qualityNotes?.startsWith("AI-RESEARCH:") ? qualityNotes.replace("AI-RESEARCH:", "").trim() : "";
  return topic || caption.split("\n")[0].slice(0, 80);
}

const KIND_CHIP: Record<FeedKind, { icon: typeof Lightbulb; tone: string }> = {
  draft: { icon: NotePencil, tone: "bg-[var(--purple-light)] text-[var(--purple)]" },
  trend: { icon: ChartLineUp, tone: "bg-[var(--blue-light)] text-[var(--blue)]" },
  competitor: { icon: Storefront, tone: "bg-[var(--rose-light)] text-[var(--rose)]" },
  holiday: { icon: Confetti, tone: "bg-[var(--amber-light)] text-[var(--amber)]" },
};

export function CreativeIdeasWorkspace({
  facebookPageId,
  drafts,
  data,
  selectedId,
}: {
  facebookPageId: string;
  drafts: Draft[];
  data: CreativeIdeasData;
  selectedId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [filter, setFilter] = useState<"all" | FeedKind>("all");
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | undefined>(selectedId ? `draft:${selectedId}` : undefined);

  const feed = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [
      ...drafts.map((draft) => ({
        key: `draft:${draft.id}`,
        kind: "draft" as const,
        title: extractTopic(draft.qualityNotes, draft.caption),
        meta: draft.scheduledAt ? `Dự kiến ${clockTime(draft.scheduledAt)}` : "Chưa đặt lịch",
        tags: [label(POST_TYPE_LABELS, draft.postType), label(TONE_LABELS, draft.tone)],
        timestamp: draft.createdAt,
        draft,
      })),
      ...data.trends.map((trend) => ({
        key: `trend:${trend.key}`,
        kind: "trend" as const,
        title: trend.topic,
        meta: label(SOURCE_LABELS, trend.source),
        tags: [],
        timestamp: trend.fetchedAt,
        trend,
      })),
      ...data.competitorTopics.map((topic) => ({
        key: `competitor:${topic.label}`,
        kind: "competitor" as const,
        title: topic.label,
        meta: `${topic.count} bài của đối thủ`,
        tags: [],
        timestamp: data.competitorMeta?.updatedAt ?? null,
        competitorCount: topic.count,
      })),
      ...data.holidays.map((holiday) => ({
        key: `holiday:${holiday.id}`,
        kind: "holiday" as const,
        title: holiday.name,
        meta: holiday.daysUntil === 0 ? "Hôm nay" : `Còn ${holiday.daysUntil} ngày`,
        tags: [],
        timestamp: null,
        holiday,
      })),
    ];
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (filter !== "all" && item.kind !== filter) return false;
      if (!needle) return true;
      return item.title.toLowerCase().includes(needle) || item.meta.toLowerCase().includes(needle);
    });
  }, [drafts, data, filter, query]);

  const selected = feed.find((item) => item.key === selectedKey) ?? feed[0];

  function select(item: FeedItem) {
    setSelectedKey(item.key);
    // Drafts are real Post rows, so keep them deep-linkable via ?id=
    if (item.kind === "draft" && item.draft) {
      const params = new URLSearchParams({ view: "overview", scope: "current", pageId: facebookPageId, id: item.draft.id });
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }

  const counts = useMemo(() => ({
    draft: drafts.length,
    trend: data.trends.length,
    competitor: data.competitorTopics.length,
    holiday: data.holidays.length,
  }), [drafts.length, data]);

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)_minmax(0,19rem)]">
      {/* ── Left: idea feed ─────────────────────────────── */}
      <section className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-card)] p-3.5 shadow-[var(--shadow-sm)]">
        <label className="flex items-center gap-2 rounded-[9px] border border-[var(--border-strong)] bg-[var(--bg)] px-3 py-2 focus-within:border-[var(--accent)]">
          <MagnifyingGlass size={15} className="shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
          <span className="sr-only">Tìm chủ đề</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm chủ đề, tín hiệu, dịp lễ…"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
          />
        </label>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {FILTERS.map((option) => {
            const active = filter === option.id;
            const count = option.id === "all" ? undefined : counts[option.id];
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setFilter(option.id)}
                aria-pressed={active}
                className={`rounded-[8px] px-2.5 py-1.5 text-[12px] font-semibold transition-colors ${
                  active
                    ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                    : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text)]"
                }`}
              >
                {option.label}{count !== undefined && count > 0 ? ` ${count}` : ""}
              </button>
            );
          })}
        </div>

        <ul className="mt-3 max-h-[38rem] space-y-1.5 overflow-y-auto pr-0.5">
          {feed.map((item) => {
            const chip = KIND_CHIP[item.kind];
            const ChipIcon = chip.icon;
            const active = selected?.key === item.key;
            return (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => select(item)}
                  aria-current={active ? "true" : undefined}
                  className={`flex w-full items-start gap-2.5 rounded-[11px] border p-2.5 text-left transition-colors ${
                    active
                      ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                      : "border-transparent hover:bg-[var(--row-hover)]"
                  }`}
                >
                  <span className={`chip-tone mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] ${chip.tone}`}>
                    <ChipIcon size={15} weight="bold" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-[var(--text)]">{item.title}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[var(--text-muted)]">
                      <span className="truncate">{item.meta}</span>
                      {item.trend?.deltaPct !== null && item.trend?.deltaPct !== undefined && (
                        <TrendPill deltaPct={item.trend.deltaPct} />
                      )}
                      {item.timestamp && <span>· {relativeTime(item.timestamp)}</span>}
                    </span>
                    {item.tags.length > 0 && (
                      <span className="mt-1.5 flex flex-wrap gap-1">
                        {item.tags.map((tag) => (
                          <span key={tag} className="rounded-[5px] bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[10.5px] font-semibold text-[var(--text-secondary)]">
                            {tag}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                  {item.trend && (
                    <span className="mt-0.5 shrink-0">
                      <ScoreChip score={item.trend.score} />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
          {feed.length === 0 && (
            <li className="px-1 py-8 text-center text-[13px] text-[var(--text-muted)]">
              Không có mục nào khớp bộ lọc.
            </li>
          )}
        </ul>
      </section>

      {/* ── Center: detail ──────────────────────────────── */}
      <section className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-sm)]">
        {selected?.kind === "draft" && selected.draft ? (
          <DraftDetail draft={selected.draft} facebookPageId={facebookPageId} data={data} />
        ) : selected ? (
          <SignalDetail item={selected} facebookPageId={facebookPageId} />
        ) : (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Lightbulb size={26} className="text-[var(--text-muted)]" aria-hidden="true" />
            <p className="text-[14px] font-semibold">Chọn một mục ở cột bên trái</p>
            <p className="max-w-sm text-[13px] text-[var(--text-muted)]">
              Bản nháp có thể chuyển sang biên tập hoặc tạo ảnh. Tín hiệu thị trường hiển thị bằng chứng đã đo được.
            </p>
          </div>
        )}
      </section>

      {/* ── Right: real side panels ─────────────────────── */}
      <div className="space-y-4">
        <Panel title="Lịch nội dung hôm nay" link={{ href: `/creative/publishing?view=calendar&scope=current&pageId=${facebookPageId}`, label: "Lịch" }}>
          {data.schedule.length > 0 ? (
            <ul>
              {data.schedule.map((row) => {
                const status = STATUS_LABELS[row.status] ?? STATUS_LABELS.draft;
                return (
                  <li key={row.id} className="row-hover -mx-1.5 flex items-center gap-2.5 rounded-[9px] px-1.5 py-2">
                    <span className="w-10 shrink-0 text-[12.5px] font-bold tabular-nums text-[var(--text-secondary)]">
                      {clockTime(row.scheduledAt)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-semibold">{row.caption.split("\n")[0]}</span>
                      <span className="text-[11px] text-[var(--text-muted)]">{label(PLATFORM_LABELS, row.platform)}</span>
                    </span>
                    <span className={`shrink-0 rounded-[5px] px-2 py-0.5 text-[10.5px] font-bold ${status.tone}`}>{status.label}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty text="Hôm nay chưa có nội dung nào lên lịch." />
          )}
        </Panel>

        <Panel title="Tài nguyên thương hiệu" link={{ href: "/system/brand-assets", label: "Quản lý" }}>
          {data.brand ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-[var(--border)] bg-[var(--bg-subtle)]">
                  {data.brand.logoUrl
                    ? <img src={data.brand.logoUrl} alt="Logo thương hiệu" className="h-full w-full object-cover" />
                    : <Palette size={18} className="text-[var(--text-muted)]" aria-hidden="true" />}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-bold">{data.brand.spaName || "Chưa đặt tên thương hiệu"}</p>
                  <p className="truncate text-[11.5px] text-[var(--text-muted)]">{data.brand.tagline || `Kiểu chữ: ${data.brand.fontStyle}`}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-[6px] border border-[var(--border)]" style={{ background: data.brand.primaryColor }} title={data.brand.primaryColor} />
                <span className="h-6 w-6 rounded-[6px] border border-[var(--border)]" style={{ background: data.brand.accentColor }} title={data.brand.accentColor} />
                <span className="text-[11.5px] tabular-nums text-[var(--text-muted)]">{data.brand.primaryColor} · {data.brand.accentColor}</span>
              </div>
            </div>
          ) : (
            <Empty text="Chưa cấu hình bộ nhận diện cho Trang này." />
          )}

          {data.assetGroups.length > 0 && (
            <ul className="mt-3 space-y-1 border-t border-[var(--border)] pt-3">
              {data.assetGroups.slice(0, 5).map((group) => (
                <li key={group.preset} className="flex items-center justify-between gap-2 text-[12px]">
                  <span className="flex min-w-0 items-center gap-2 text-[var(--text-secondary)]">
                    <ImageIcon size={14} className="shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
                    <span className="truncate">{label(PRESET_LABELS, group.preset)}</span>
                  </span>
                  <span className="shrink-0 font-bold tabular-nums">{group.count} ảnh</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Nguồn dữ liệu nghiên cứu">
          {data.signalSources.length > 0 ? (
            <ul className="space-y-2">
              {data.signalSources.map((source) => (
                <li key={source.source} className="flex items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] font-semibold">{label(SOURCE_LABELS, source.source)}</span>
                    <span className="text-[11px] text-[var(--text-muted)]">Cập nhật {relativeTime(source.lastFetchedAt)}</span>
                  </span>
                  <span className="shrink-0 text-[12px] font-bold tabular-nums text-[var(--text-secondary)]">{source.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty text="Chưa có tín hiệu nào được đồng bộ." />
          )}
          {data.competitorMeta && (
            <p className="mt-3 border-t border-[var(--border)] pt-3 text-[11.5px] leading-relaxed text-[var(--text-muted)]">
              Học từ <b className="text-[var(--text-secondary)]">{data.competitorMeta.sampleCount}</b> bài của đối thủ · độ tin cậy{" "}
              <b className="text-[var(--text-secondary)]">{Math.round(data.competitorMeta.confidence * 100)}%</b>
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ── pieces ───────────────────────────────────────────── */

function TrendPill({ deltaPct }: { deltaPct: number }) {
  if (deltaPct === 0) return null;
  const up = deltaPct > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-[5px] px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums ${
      up ? "bg-[var(--green-light)] text-[var(--green)]" : "bg-[var(--danger-light)] text-[var(--danger)]"
    }`}>
      {up ? <TrendUp size={10} weight="bold" aria-hidden="true" /> : <TrendDown size={10} weight="bold" aria-hidden="true" />}
      {Math.abs(deltaPct)}%
    </span>
  );
}

function DraftDetail({ draft, facebookPageId, data }: { draft: Draft; facebookPageId: string; data: CreativeIdeasData }) {
  const router = useRouter();
  const scope = `scope=current&pageId=${facebookPageId}`;
  const wordCount = countWords(draft.caption);
  // Benchmark against the channels this draft is actually aimed at; when the
  // author has not picked any, fall back to every connected channel.
  const benchmarkChannels = draft.brief.targetChannels.length > 0
    ? draft.brief.targetChannels.filter((channel) => data.connectedChannels.includes(channel))
    : data.connectedChannels;
  const [videoPending, setVideoPending] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  // Real hand-off: the draft becomes the video project's source, and the studio
  // opens on the project that was just created.
  async function createVideoProject() {
    setVideoPending(true);
    setVideoError(null);
    try {
      const response = await fetch("/api/video-studio/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facebookPageId, sourcePostId: draft.id }),
      });
      const payload = (await response.json().catch(() => null)) as { success?: boolean; error?: string; data?: { id?: string } } | null;
      if (!response.ok || !payload?.success || !payload.data?.id) {
        throw new Error(payload?.error || "Không tạo được dự án video, thử lại sau");
      }
      // Keep the pending state through navigation so the action cannot double-fire.
      router.push(`/creative/video?view=projects&${scope}&id=${payload.data.id}`);
    } catch (error) {
      setVideoError(error instanceof Error ? error.message : "Không tạo được dự án video, thử lại sau");
      setVideoPending(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[19px] font-extrabold leading-snug tracking-tight">
            {draft.brief.title || extractTopic(draft.qualityNotes, draft.caption)}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {/* postType/tone and topicTags overlap (both can say "Kiến thức"), so dedupe. */}
            {[...new Set([
              label(POST_TYPE_LABELS, draft.postType),
              label(TONE_LABELS, draft.tone),
              ...draft.brief.topicTags,
            ])].map((tag) => <Tag key={tag} label={tag} />)}
            {/* The author's chosen channels. One they have not connected is shown
                struck through, so the chip never implies the app can publish there. */}
            {draft.brief.targetChannels.map((channel) => {
              const connected = data.connectedChannels.includes(channel);
              return (
                <span
                  key={channel}
                  title={connected ? undefined : "Kênh này chưa được kết nối"}
                  className={`rounded-[5px] px-2 py-0.5 text-[11px] font-bold ${
                    connected
                      ? "bg-[var(--bg-subtle)] text-[var(--text-secondary)]"
                      : "bg-transparent text-[var(--text-muted)] line-through decoration-[var(--text-muted)]/60"
                  }`}
                >
                  {label(PLATFORM_LABELS, channel)}
                </span>
              );
            })}
            {draft.brief.targetChannels.some((channel) => !data.connectedChannels.includes(channel)) && (
              <span className="text-[11px] font-semibold text-[var(--text-muted)]">chưa kết nối</span>
            )}
            <span className="text-[11.5px] text-[var(--text-muted)]">
              {draft.scheduledAt ? `Dự kiến ${clockTime(draft.scheduledAt)}` : "Chưa đặt lịch"} · tạo {relativeTime(draft.createdAt)}
            </span>
          </div>
        </div>
      </div>

      {draft.brief.summary && (
        <section className="mt-5">
          <SectionLabel icon={Files} text="Tóm tắt ý tưởng" />
          <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--text-secondary)]">{draft.brief.summary}</p>
        </section>
      )}

      {draft.brief.outline.length > 0 && (
        <section className="mt-5">
          <SectionLabel icon={ListBullets} text="Dàn ý nội dung" />
          <ul className="mt-2 space-y-1.5">
            {draft.brief.outline.map((item, index) => (
              <li key={`${index}-${item}`} className="flex gap-2.5 text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {draft.brief.hooks.length > 0 && (
        <section className="mt-5">
          <SectionLabel icon={Lightning} text="Hook gợi ý" />
          <ol className="mt-2 space-y-2">
            {draft.brief.hooks.map((hook, index) => (
              <li key={`${index}-${hook}`} className="flex gap-2.5 text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent-light)] text-[11px] font-bold text-[var(--accent)]">
                  {index + 1}
                </span>
                <span>{hook}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="mt-5">
        <SectionLabel icon={NotePencil} text="Caption AI nháp" />
        <p className="mt-2 whitespace-pre-wrap text-[13.5px] leading-relaxed text-[var(--text-secondary)]">{draft.caption}</p>
        {draft.hashtags && (
          <p className="mt-3 text-[12.5px] font-medium text-[var(--accent)]">{draft.hashtags}</p>
        )}
      </section>

      {draft.assets.length > 0 && (
        <section className="mt-5">
          <SectionLabel icon={Paperclip} text={`Gắn tài nguyên (${draft.assets.length})`} />
          <ul className="mt-2.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {draft.assets.map((asset) => <AssetCard key={asset.id} asset={asset} />)}
          </ul>
        </section>
      )}

      {briefIsEmpty(draft.brief) && (
        <p className="mt-5 rounded-[10px] bg-[var(--bg-subtle)] p-3 text-[12px] leading-relaxed text-[var(--text-muted)]">
          Bản nháp này chưa có tiêu đề, tóm tắt, dàn ý hay hook. Nội dung tạo mới sẽ có sẵn các phần đó; bản cũ có thể bổ sung ở
          bước <b className="text-[var(--text-secondary)]">Biên tập</b>.
        </p>
      )}

      <section className="mt-6 border-t border-[var(--border)] pt-5">
        <SectionLabel icon={PaperPlaneTilt} text={`Kênh nên đăng · caption ${wordCount} từ`} />
        <ChannelSuggestions
          connected={data.connectedChannels}
          wordCount={wordCount}
          history={data.channelHistory}
          targetChannels={draft.brief.targetChannels}
        />
      </section>

      <section className="mt-5">
        <SectionLabel icon={Target} text="Hiệu quả tương tự đã đo" />
        <MeasuredBenchmark benchmarks={data.benchmarks} postType={draft.postType} channels={benchmarkChannels} />
      </section>

      <div className="mt-6 flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
        <Link
          href={`/creative/content?view=editor&${scope}&id=${draft.id}`}
          className="flex min-h-11 items-center gap-2 rounded-[9px] bg-[var(--accent)] px-4 text-[13px] font-bold text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)]"
        >
          <ArrowRight size={16} weight="bold" aria-hidden="true" />Chuyển sang biên tập
        </Link>
        <Link
          href={`/creative/images?view=create&${scope}&id=${draft.id}`}
          className="flex min-h-11 items-center gap-2 rounded-[9px] border border-[var(--border-strong)] px-4 text-[13px] font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          <Sparkle size={16} aria-hidden="true" />Tạo ảnh AI
        </Link>
        <button
          type="button"
          onClick={createVideoProject}
          disabled={videoPending}
          aria-busy={videoPending}
          className="flex min-h-11 items-center gap-2 rounded-[9px] border border-[var(--border-strong)] px-4 text-[13px] font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--premium)] hover:text-[var(--premium)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <VideoCamera size={16} aria-hidden="true" />{videoPending ? "Đang tạo dự án video…" : "Tạo dự án video"}
        </button>
      </div>
      {videoError && (
        <p role="alert" className="mt-3 rounded-[9px] bg-[var(--danger-light)] px-3 py-2 text-[12.5px] font-semibold text-[var(--danger)]">
          {videoError}
        </p>
      )}
    </div>
  );
}

function AssetCard({ asset }: { asset: DraftAsset }) {
  const isVideo = asset.kind === "video";
  const format = formatLabelFromMime(asset.mimeType);
  const size = formatBytes(asset.sizeBytes);
  const duration = formatDuration(asset.durationSec);
  const meta = [format, size].filter(Boolean).join(" · ");
  return (
    <li className="overflow-hidden rounded-[11px] border border-[var(--border)] bg-[var(--bg-card)]">
      <div className="relative flex aspect-[4/3] items-center justify-center bg-[var(--bg-subtle)]">
        {isVideo
          ? <VideoCamera size={22} className="text-[var(--text-muted)]" aria-hidden="true" />
          : <ImageIcon size={22} className="text-[var(--text-muted)]" aria-hidden="true" />}
        {duration && (
          <span className="absolute bottom-1.5 right-1.5 rounded-[5px] bg-[var(--side)]/85 px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums text-white">
            {duration}
          </span>
        )}
      </div>
      <div className="p-2.5">
        <p className="truncate text-[12px] font-semibold" title={asset.name}>{asset.name}</p>
        <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{meta || (isVideo ? "Video" : "Ảnh")}</p>
      </div>
    </li>
  );
}

function SignalDetail({ item, facebookPageId }: { item: FeedItem; facebookPageId: string }) {
  const chip = KIND_CHIP[item.kind];
  const ChipIcon = chip.icon;
  return (
    <div>
      <div className="flex items-start gap-3">
        <span className={`chip-tone flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] ${chip.tone}`}>
          <ChipIcon size={18} weight="bold" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="text-[19px] font-extrabold leading-snug tracking-tight">{item.title}</h3>
          <p className="mt-1 text-[12.5px] text-[var(--text-muted)]">{item.meta}</p>
        </div>
      </div>

      {item.trend && (
        <section className="mt-5">
          <SectionLabel icon={Target} text="Điểm cơ hội" />
          <div className="mt-2.5">
            <ScoreBreakdown score={item.trend.score} />
          </div>
        </section>
      )}

      <section className="mt-5">
        <SectionLabel icon={ChartLineUp} text="Bằng chứng đã đo" />
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          {item.trend && (
            <>
              <Fact term="Nguồn" value={label(SOURCE_LABELS, item.trend.source)} />
              <Fact term="Chỉ số nguồn" value={item.trend.volume.toLocaleString("vi-VN")} />
              <Fact
                term="Thay đổi so với lần đo trước"
                value={item.trend.deltaPct === null ? "Chưa có mẫu trước để so sánh" : `${item.trend.deltaPct > 0 ? "+" : ""}${item.trend.deltaPct}%`}
              />
              <Fact term="Đồng bộ lúc" value={relativeTime(item.trend.fetchedAt)} />
              <Fact
                term="Nguồn cùng báo chủ đề"
                value={item.trend.sourceCount > 1 ? `${item.trend.sourceCount} nguồn` : "1 nguồn"}
              />
              <Fact
                term="Đối thủ về chủ đề này"
                value={item.trend.competitorMatch ? `${item.trend.competitorMatch.count} bài` : "Không khớp chủ đề nào"}
              />
              {item.trend.holidayMatch && (
                <Fact
                  term="Dịp lễ liên quan"
                  value={`${item.trend.holidayMatch.name} · ${
                    item.trend.holidayMatch.daysUntil === 0 ? "hôm nay" : `còn ${item.trend.holidayMatch.daysUntil} ngày`
                  }`}
                />
              )}
            </>
          )}
          {item.kind === "competitor" && <Fact term="Số bài của đối thủ" value={String(item.competitorCount ?? 0)} />}
          {item.holiday && (
            <>
              <Fact term="Ngày" value={item.holiday.date} />
              <Fact term="Còn lại" value={item.holiday.daysUntil === 0 ? "Hôm nay" : `${item.holiday.daysUntil} ngày`} />
              {item.holiday.description && <Fact term="Ghi chú" value={item.holiday.description} />}
            </>
          )}
        </dl>
        <p className="mt-4 rounded-[10px] bg-[var(--bg-subtle)] p-3 text-[12px] leading-relaxed text-[var(--text-muted)]">
          Đây là tín hiệu thị trường đã lưu, chưa phải bản nháp. Sang tab <b className="text-[var(--text-secondary)]">Nghiên cứu</b> để
          sinh nội dung có bằng chứng từ các tín hiệu này.
        </p>
      </section>

      <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
        <Link
          href={`/creative/ideas?view=research&scope=current&pageId=${facebookPageId}`}
          className="flex min-h-11 items-center gap-2 rounded-[9px] bg-[var(--accent)] px-4 text-[13px] font-bold text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)]"
        >
          <Files size={16} aria-hidden="true" />Mở nghiên cứu
        </Link>
      </div>
    </div>
  );
}

function Panel({ title, link, children }: { title: string; link?: { href: string; label: string }; children: React.ReactNode }) {
  return (
    <section className="surface-hover rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-card)] p-[18px] shadow-[var(--shadow-sm)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[14px] font-bold">{title}</h3>
        {link && (
          <Link href={link.href} className="shrink-0 text-[12px] font-bold text-[var(--accent)] transition-opacity hover:opacity-70">
            {link.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function SectionLabel({ icon: IconComponent, text }: { icon: typeof Lightbulb; text: string }) {
  return (
    <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
      <IconComponent size={14} aria-hidden="true" />{text}
    </p>
  );
}

function Fact({ term, value }: { term: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-[var(--border)] p-3">
      <dt className="text-[11px] uppercase tracking-[0.06em] text-[var(--text-muted)]">{term}</dt>
      <dd className="mt-1 text-[13.5px] font-semibold">{value}</dd>
    </div>
  );
}

function Tag({ label: text }: { label: string }) {
  return <span className="rounded-[5px] bg-[var(--accent-light)] px-2 py-0.5 text-[11px] font-bold text-[var(--accent)]">{text}</span>;
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 py-4 text-[12.5px] text-[var(--text-muted)]">
      <CalendarBlank size={16} aria-hidden="true" />{text}
    </div>
  );
}
