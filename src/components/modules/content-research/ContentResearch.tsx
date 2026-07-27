"use client";

/**
 * "Nghiên cứu" and "Kho ý tưởng": generate an AI content plan, then triage the
 * drafts it produced (schedule or discard).
 *
 * Labels come from creative-labels.ts. This file used to keep its own copies,
 * which had drifted — the same draft read "Cảm nhận" on the ideas overview and
 * "Đánh giá" here.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowsClockwise,
  CalendarBlank,
  Check,
  Clock,
  FileText,
  Lightbulb,
  ListBullets,
  Robot,
  Sparkle,
  TrashSimple,
  X,
} from "@phosphor-icons/react";
import { useActivePage } from "@/contexts/ActivePageContext";
import type { PostBrief } from "@/lib/creative-brief";
import { POST_TYPE_LABELS, TONE_LABELS, label } from "@/lib/creative-labels";

export interface ResearchDraftData {
  id: string;
  caption: string;
  hashtags: string | null;
  postType: string;
  tone: string;
  scheduledAt: string | null;
  qualityNotes: string | null;
  createdAt: string;
  brief?: PostBrief;
}

function extractTopic(notes: string | null): string {
  if (!notes) return "";
  return notes.replace("AI-RESEARCH:", "").trim();
}

function stamp(iso: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(iso));
}

/** datetime-local wants the user's wall clock, so shift out of UTC. */
function toLocalInput(iso: string) {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function ContentResearch({
  facebookPageId: providedPageId,
  canMutate = true,
  mode = "research",
  initialDrafts,
}: {
  facebookPageId?: string;
  canMutate?: boolean;
  mode?: "overview" | "research" | "backlog";
  initialDrafts?: ResearchDraftData[];
} = {}) {
  const { selectedPageId } = useActivePage();
  const facebookPageId = providedPageId ?? selectedPageId ?? undefined;
  const [drafts, setDrafts] = useState<ResearchDraftData[]>(initialDrafts ?? []);
  const [loading, setLoading] = useState(initialDrafts === undefined);
  const [generating, setGenerating] = useState(false);
  const [daysAhead, setDaysAhead] = useState("7");
  const [postsPerDay, setPostsPerDay] = useState("1");
  const [actionId, setActionId] = useState<string | null>(null);
  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ created: number } | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!facebookPageId) {
      setDrafts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/content-research?${new URLSearchParams({ facebookPageId })}`);
      const json = await response.json();
      if (json.success) setDrafts(json.data);
      else setError(json.error ?? "Không tải được danh sách ý tưởng");
    } catch {
      setError("Không tải được danh sách ý tưởng");
    } finally {
      setLoading(false);
    }
  }, [facebookPageId]);

  useEffect(() => {
    if (initialDrafts !== undefined) {
      setDrafts(initialDrafts);
      setLoading(false);
      return;
    }
    load();
  }, [initialDrafts, load]);

  const generate = async () => {
    setGenerating(true);
    setResult(null);
    setError("");
    try {
      const response = await fetch("/api/content-research", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          daysAhead: Number(daysAhead),
          postsPerDay: Number(postsPerDay),
          facebookPageId,
        }),
      });
      const json = await response.json();
      if (json.success) {
        setResult(json.data);
        await load();
      } else {
        setError(json.error ?? "Không tạo được kế hoạch nội dung");
      }
    } catch {
      setError("Không tạo được kế hoạch nội dung");
    } finally {
      setGenerating(false);
    }
  };

  const act = async (postId: string, key: string, body: Record<string, unknown>) => {
    setActionId(postId + key);
    setError("");
    try {
      const response = await fetch("/api/content-research", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...body, postId, facebookPageId }),
      });
      const json = await response.json();
      if (!json.success) setError(json.error ?? "Không thực hiện được thao tác");
      await load();
    } catch {
      setError("Không thực hiện được thao tác");
    } finally {
      setActionId(null);
      setSchedulingId(null);
    }
  };

  const scheduled = drafts.filter((draft) => draft.scheduledAt).length;
  const withBrief = drafts.filter((draft) => draft.brief && (draft.brief.outline.length > 0 || draft.brief.summary)).length;
  const heading = mode === "backlog" ? "Kho ý tưởng" : mode === "overview" ? "Ý tưởng ưu tiên" : "Bản nháp AI vừa tạo";

  return (
    <div className="space-y-4">
      {mode === "overview" && (
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Ý tưởng đang chờ" value={drafts.length} />
          <StatCard label="Đã có lịch đề xuất" value={scheduled} />
          <StatCard label="Có brief đầy đủ" value={withBrief} />
        </div>
      )}

      {mode === "research" && (canMutate ? (
        <section className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-sm)]">
          <div className="flex items-start gap-3">
            <span className="chip-tone flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--purple-light)] text-[var(--purple)]">
              <Robot size={17} weight="bold" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-[16px] font-extrabold tracking-tight">Tạo kế hoạch nội dung bằng AI</h2>
              <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                AI đọc dịch vụ của spa, các bài đã đăng hiệu quả nhất, dịp lễ sắp tới và bài của đối thủ, rồi đề xuất
                caption kèm lịch đăng. Mỗi bài tạo ra là một bản nháp — bạn duyệt trước khi lên lịch.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <NumberField label="Số ngày tới" value={daysAhead} min={1} max={30} onChange={setDaysAhead} />
            <NumberField label="Bài mỗi ngày" value={postsPerDay} min={1} max={3} onChange={setPostsPerDay} />
            <button
              type="button"
              onClick={generate}
              disabled={generating || !facebookPageId}
              aria-busy={generating}
              className="flex min-h-11 items-center gap-2 rounded-[9px] bg-[var(--accent)] px-4 text-[13px] font-bold text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Sparkle size={16} weight="fill" aria-hidden="true" />
              {generating ? "Đang tạo…" : `Tạo ${Number(daysAhead) * Number(postsPerDay)} bài`}
            </button>
          </div>

          {generating && (
            <p className="mt-3 text-[12px] text-[var(--text-muted)]">
              Quá trình này gọi Claude rồi GPT phản biện rồi Claude chỉnh lại, nên có thể mất một vài phút.
            </p>
          )}
          {result && (
            <p className="mt-3 flex items-center gap-1.5 rounded-[9px] bg-[var(--green-light)] px-3 py-2 text-[12.5px] font-semibold text-[var(--green)]">
              <Check size={14} weight="bold" aria-hidden="true" />
              Đã tạo {result.created} bản nháp — duyệt và lên lịch ở danh sách dưới.
            </p>
          )}
        </section>
      ) : (
        <section className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-card)] p-4 text-[13px] text-[var(--text-secondary)]">
          Bạn xem được ý tưởng của Trang này, nhưng chỉ chủ sở hữu mới tạo, lên lịch hoặc loại bỏ ý tưởng.
        </section>
      ))}

      {error && (
        <p role="alert" className="rounded-[9px] bg-[var(--danger-light)] px-3 py-2 text-[12.5px] font-semibold text-[var(--danger)]">
          {error}
        </p>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-[15px] font-bold">
            <Lightbulb size={16} weight="bold" className="text-[var(--accent)]" aria-hidden="true" />
            {heading}
            <span className="rounded-[5px] bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-[var(--text-secondary)]">
              {drafts.length}
            </span>
          </h2>
          {initialDrafts === undefined && (
            <button
              type="button"
              onClick={load}
              aria-label="Làm mới danh sách ý tưởng"
              className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-[var(--border-strong)] text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              <ArrowsClockwise size={15} aria-hidden="true" />
            </button>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((key) => <div key={key} className="skeleton h-36 rounded-[var(--radius-xl)]" />)}
          </div>
        ) : drafts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-card)] py-14 text-center">
            <Sparkle size={26} className="text-[var(--text-muted)]" aria-hidden="true" />
            <p className="text-[13.5px] font-semibold">Chưa có bản nháp nào</p>
            <p className="max-w-sm text-[12.5px] text-[var(--text-muted)]">
              {mode === "research"
                ? "Nhấn “Tạo … bài” ở trên để AI đề xuất kế hoạch nội dung."
                : "Ý tưởng đã lên lịch hoặc đã loại bỏ sẽ không còn ở đây."}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {drafts.map((draft) => (
              <DraftCard
                key={draft.id}
                draft={draft}
                facebookPageId={facebookPageId}
                canMutate={canMutate}
                busyKey={actionId}
                scheduling={schedulingId === draft.id}
                scheduleValue={scheduleDate[draft.id] ?? ""}
                onScheduleValue={(value) => setScheduleDate((prev) => ({ ...prev, [draft.id]: value }))}
                onOpenSchedule={() => {
                  setSchedulingId(draft.id);
                  if (draft.scheduledAt) {
                    setScheduleDate((prev) => ({ ...prev, [draft.id]: toLocalInput(draft.scheduledAt!) }));
                  }
                }}
                onCancelSchedule={() => setSchedulingId(null)}
                onSchedule={() => {
                  const at = scheduleDate[draft.id];
                  if (!at) return;
                  act(draft.id, "schedule", { action: "schedule", scheduledAt: new Date(at).toISOString() });
                }}
                onDiscard={() => act(draft.id, "discard", { action: "discard" })}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function DraftCard({
  draft,
  facebookPageId,
  canMutate,
  busyKey,
  scheduling,
  scheduleValue,
  onScheduleValue,
  onOpenSchedule,
  onCancelSchedule,
  onSchedule,
  onDiscard,
}: {
  draft: ResearchDraftData;
  facebookPageId?: string;
  canMutate: boolean;
  busyKey: string | null;
  scheduling: boolean;
  scheduleValue: string;
  onScheduleValue: (value: string) => void;
  onOpenSchedule: () => void;
  onCancelSchedule: () => void;
  onSchedule: () => void;
  onDiscard: () => void;
}) {
  const topic = draft.brief?.title?.trim() || extractTopic(draft.qualityNotes);
  const outline = draft.brief?.outline ?? [];

  return (
    <li className="surface-hover rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-sm)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {topic && <h3 className="text-[14.5px] font-extrabold leading-snug tracking-tight">{topic}</h3>}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
            <Chip>{label(POST_TYPE_LABELS, draft.postType)}</Chip>
            <Chip>{label(TONE_LABELS, draft.tone)}</Chip>
            {draft.scheduledAt ? (
              <span className="flex items-center gap-1 rounded-[5px] bg-[var(--amber-light)] px-1.5 py-0.5 font-bold text-[var(--amber)]">
                <Clock size={10} weight="bold" aria-hidden="true" />
                {stamp(draft.scheduledAt)}
              </span>
            ) : (
              <span className="text-[var(--text-muted)]">Chưa đặt lịch</span>
            )}
          </div>
        </div>
        {canMutate && (
          <button
            type="button"
            onClick={onDiscard}
            disabled={busyKey === draft.id + "discard"}
            aria-label="Loại bỏ ý tưởng"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] text-[var(--text-muted)] transition-colors hover:bg-[var(--danger-light)] hover:text-[var(--danger)] disabled:opacity-40"
          >
            <TrashSimple size={15} aria-hidden="true" />
          </button>
        )}
      </div>

      {draft.brief?.summary && (
        <p className="mt-3 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">{draft.brief.summary}</p>
      )}

      {outline.length > 0 && (
        <div className="mt-3">
          <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.07em] text-[var(--text-muted)]">
            <ListBullets size={12} aria-hidden="true" />Dàn ý {outline.length} ý
          </p>
          <ul className="mt-1.5 space-y-1">
            {outline.slice(0, 3).map((item, index) => (
              <li key={`${index}-${item}`} className="flex gap-2 text-[12.5px] text-[var(--text-secondary)]">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--accent)]" />
                <span className="truncate">{item}</span>
              </li>
            ))}
            {outline.length > 3 && (
              <li className="pl-3 text-[11.5px] text-[var(--text-muted)]">và {outline.length - 3} ý nữa</li>
            )}
          </ul>
        </div>
      )}

      {/* Clamped so a list of drafts stays scannable; the editor shows it in full. */}
      <p className="mt-3 line-clamp-6 whitespace-pre-line text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
        {draft.caption}
      </p>
      {draft.hashtags && <p className="mt-2 text-[12px] font-medium text-[var(--accent)]">{draft.hashtags}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-3">
        {canMutate && (scheduling ? (
          <>
            <input
              type="datetime-local"
              aria-label="Thời điểm đăng"
              value={scheduleValue}
              onChange={(event) => onScheduleValue(event.target.value)}
              className="rounded-[8px] border border-[var(--border-strong)] bg-[var(--bg)] px-2.5 py-2 text-[12.5px] text-[var(--text)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--brand-ring)]"
            />
            <button
              type="button"
              onClick={onSchedule}
              disabled={!scheduleValue || busyKey === draft.id + "schedule"}
              className="flex min-h-10 items-center gap-1.5 rounded-[8px] bg-[var(--accent)] px-3 text-[12.5px] font-bold text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Check size={14} weight="bold" aria-hidden="true" />Lên lịch
            </button>
            <button
              type="button"
              onClick={onCancelSchedule}
              className="flex min-h-10 items-center gap-1.5 rounded-[8px] border border-[var(--border-strong)] px-3 text-[12.5px] font-semibold text-[var(--text-secondary)] transition-colors hover:text-[var(--text)]"
            >
              <X size={13} aria-hidden="true" />Huỷ
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onOpenSchedule}
            className="flex min-h-10 items-center gap-1.5 rounded-[8px] border border-[var(--border-strong)] px-3 text-[12.5px] font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <CalendarBlank size={14} aria-hidden="true" />
            {draft.scheduledAt ? "Đổi lịch đăng" : "Lên lịch đăng"}
          </button>
        ))}
        {facebookPageId && (
          <Link
            href={`/creative/content?view=editor&scope=current&pageId=${facebookPageId}&id=${draft.id}`}
            className="flex min-h-10 items-center gap-1.5 rounded-[8px] px-2 text-[12.5px] font-bold text-[var(--accent)] transition-opacity hover:opacity-70"
          >
            <FileText size={14} aria-hidden="true" />Mở biên tập
          </Link>
        )}
      </div>
    </li>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-[5px] bg-[var(--bg-subtle)] px-1.5 py-0.5 font-bold text-[var(--text-secondary)]">{children}</span>
  );
}

function StatCard({ label: text, value }: { label: string; value: number }) {
  return (
    <div className="surface-hover rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-sm)]">
      <p className="text-[11.5px] text-[var(--text-muted)]">{text}</p>
      <p className="mt-1 text-[26px] font-extrabold leading-none tabular-nums tracking-tight">{value}</p>
    </div>
  );
}

function NumberField({
  label: text,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: string;
  min: number;
  max: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block w-32">
      <span className="mb-1 block text-[12px] font-bold text-[var(--text-secondary)]">{text}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-[9px] border border-[var(--border-strong)] bg-[var(--bg)] px-3 py-2 text-[13px] tabular-nums text-[var(--text)] outline-none transition-colors focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--brand-ring)]"
      />
    </label>
  );
}
