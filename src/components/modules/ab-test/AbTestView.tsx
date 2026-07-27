"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowsSplit, CaretDown, ChatsTeardrop, Trophy } from "@phosphor-icons/react";
import { useActivePage } from "@/contexts/ActivePageContext";
import { truncate } from "@/lib/utils";

interface Analytics { likes: number; comments: number; shares: number; reach: number; }
interface Post { id: string; caption: string; status: string; qualityNotes: string | null; analytics: Analytics | null; }
interface Group { abGroupId: string; posts: Post[]; createdAt: string; }

/**
 * Weighted engagement: a comment counts twice a like, a share three times.
 * The weights are shown to the user rather than hidden behind a bare "điểm",
 * so the ranking is checkable against the three measured counts beside it.
 */
const WEIGHTS = { likes: 1, comments: 2, shares: 3 } as const;

function engagementScore(analytics: Analytics | null) {
  if (!analytics) return 0;
  return (
    (analytics.likes ?? 0) * WEIGHTS.likes +
    (analytics.comments ?? 0) * WEIGHTS.comments +
    (analytics.shares ?? 0) * WEIGHTS.shares
  );
}

interface JudgeTurn { speaker: string; provider: "claude" | "openai"; content: string; }
interface JudgeResult { synthesis: string; turns: JudgeTurn[]; }

export function AbTestView({
  facebookPageId: providedPageId,
  canMutate = true,
}: {
  facebookPageId?: string;
  canMutate?: boolean;
} = {}) {
  const { selectedPageId } = useActivePage();
  const facebookPageId = providedPageId ?? selectedPageId ?? undefined;
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [declaring, setDeclaring] = useState<string | null>(null);
  const [judging, setJudging] = useState<string | null>(null);
  const [judgeResults, setJudgeResults] = useState<Record<string, JudgeResult>>({});
  const [expandedDebate, setExpandedDebate] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!facebookPageId) {
      setGroups([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/ab-test?${new URLSearchParams({ facebookPageId })}`);
      const data = await response.json();
      if (data.success) setGroups(data.data);
      else setError(data.error ?? "Không tải được danh sách A/B test");
    } catch {
      setError("Không tải được danh sách A/B test");
    } finally {
      setLoading(false);
    }
  }, [facebookPageId]);

  useEffect(() => { load(); }, [load]);

  const runJudge = async (abGroupId: string) => {
    setJudging(abGroupId);
    setError("");
    try {
      const response = await fetch("/api/ab-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "judge", abGroupId, facebookPageId }),
      });
      const data = await response.json();
      if (data.success) {
        setJudgeResults((prev) => ({ ...prev, [abGroupId]: { synthesis: data.data.synthesis, turns: data.data.turns } }));
        setExpandedDebate((prev) => ({ ...prev, [abGroupId]: false }));
      } else {
        setError(data.error ?? "Không chạy được AI Council");
      }
    } catch {
      setError("Không chạy được AI Council");
    } finally {
      setJudging(null);
    }
  };

  const declareWinner = async (winnerId: string, abGroupId: string) => {
    setDeclaring(winnerId);
    setError("");
    try {
      const response = await fetch("/api/ab-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "declare-winner", winnerId, abGroupId, facebookPageId }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.success === false) setError(data?.error ?? "Không chốt được kết quả");
      await load();
    } catch {
      setError("Không chốt được kết quả");
    } finally {
      setDeclaring(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl space-y-4">
        {[1, 2].map((key) => <div key={key} className="skeleton h-56 rounded-[var(--radius-xl)]" />)}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-2 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-card)] py-16 text-center">
        <ArrowsSplit size={28} className="text-[var(--text-muted)]" aria-hidden="true" />
        <p className="text-[13.5px] font-semibold">Chưa có A/B test nào</p>
        <p className="max-w-xs text-[12.5px] leading-relaxed text-[var(--text-muted)]">
          Soạn bài ở tab Biên tập rồi tạo <b className="text-[var(--text-secondary)]">A/B Test</b> để sinh hai phiên bản caption cho cùng một nội dung.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-4">
      {error && (
        <p role="alert" className="rounded-[9px] bg-[var(--danger-light)] px-3 py-2 text-[12.5px] font-semibold text-[var(--danger)]">
          {error}
        </p>
      )}

      {groups.map((group) => {
        const [postA, postB] = group.posts;
        if (!postA || !postB) return null;

        const scoreA = engagementScore(postA.analytics);
        const scoreB = engagementScore(postB.analytics);
        const hasAnalytics = Boolean(postA.analytics || postB.analytics);
        const leader = hasAnalytics ? (scoreA >= scoreB ? postA.id : postB.id) : null;
        const isDeclared = group.posts.some((post) => post.qualityNotes?.includes("Thắng") || post.qualityNotes?.includes("Thua"));
        const judged = judgeResults[group.abGroupId];

        return (
          <section
            key={group.abGroupId}
            className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-sm)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-[16px] font-extrabold tracking-tight">A/B Test #{group.abGroupId.slice(0, 6)}</h2>
                <p className="mt-0.5 text-[11.5px] text-[var(--text-muted)]">
                  Tạo {new Date(group.createdAt).toLocaleDateString("vi-VN")}
                  {isDeclared && " · đã chốt kết quả"}
                </p>
              </div>
              {canMutate && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => runJudge(group.abGroupId)}
                    disabled={judging === group.abGroupId}
                    aria-busy={judging === group.abGroupId}
                    className="flex min-h-10 items-center gap-1.5 rounded-[8px] border border-[var(--border-strong)] px-3 text-[12.5px] font-bold text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChatsTeardrop size={14} weight="fill" aria-hidden="true" />
                    {judging === group.abGroupId ? "Đang phân tích…" : "AI Council phân tích"}
                  </button>
                  {!isDeclared && leader && (
                    <button
                      type="button"
                      onClick={() => declareWinner(leader, group.abGroupId)}
                      disabled={declaring === leader}
                      className="flex min-h-10 items-center gap-1.5 rounded-[8px] bg-[var(--accent)] px-3 text-[12.5px] font-bold text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trophy size={14} weight="fill" aria-hidden="true" />
                      {declaring === leader ? "Đang chốt…" : "Chốt phiên bản thắng"}
                    </button>
                  )}
                </div>
              )}
            </div>

            {judged && (
              <div className="mt-4 rounded-[12px] border border-[var(--accent)]/35 bg-[var(--accent-soft)] p-4">
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.07em] text-[var(--accent)]">
                  <ChatsTeardrop size={13} weight="fill" aria-hidden="true" />
                  Phán quyết của AI Council
                </p>
                <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--text)]">{judged.synthesis}</p>
                <button
                  type="button"
                  onClick={() => setExpandedDebate((prev) => ({ ...prev, [group.abGroupId]: !prev[group.abGroupId] }))}
                  aria-expanded={Boolean(expandedDebate[group.abGroupId])}
                  className="mt-3 flex items-center gap-1 text-[11.5px] font-bold text-[var(--accent)] transition-opacity hover:opacity-70"
                >
                  {expandedDebate[group.abGroupId] ? "Ẩn" : "Xem"} cuộc tranh luận đầy đủ
                  <CaretDown
                    size={11}
                    weight="bold"
                    aria-hidden="true"
                    className={`transition-transform ${expandedDebate[group.abGroupId] ? "rotate-180" : ""}`}
                  />
                </button>
                {expandedDebate[group.abGroupId] && (
                  <ul className="mt-3 space-y-2">
                    {judged.turns.map((turn, index) => (
                      <li
                        key={`${index}-${turn.speaker}`}
                        className="rounded-[9px] border-l-[3px] bg-[var(--bg-card)] p-2.5"
                        style={{ borderLeftColor: turn.provider === "claude" ? "var(--accent)" : "var(--blue)" }}
                      >
                        <p
                          className="text-[10.5px] font-bold uppercase tracking-[0.07em]"
                          style={{ color: turn.provider === "claude" ? "var(--accent)" : "var(--blue)" }}
                        >
                          {turn.speaker}
                        </p>
                        <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-secondary)]">{turn.content}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {[postA, postB].map((post, index) => (
                <VariantCard
                  key={post.id}
                  post={post}
                  letter={String.fromCharCode(65 + index)}
                  score={engagementScore(post.analytics)}
                  leading={leader === post.id && hasAnalytics}
                  hasAnalytics={hasAnalytics}
                />
              ))}
            </div>

            {hasAnalytics && (
              <p className="mt-3 text-[11px] leading-relaxed text-[var(--text-muted)]">
                Điểm tương tác = thích ×{WEIGHTS.likes} + bình luận ×{WEIGHTS.comments} + chia sẻ ×{WEIGHTS.shares}, tính
                trên số đo thật của từng bài.
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}

function VariantCard({
  post,
  letter,
  score,
  leading,
  hasAnalytics,
}: {
  post: Post;
  letter: string;
  score: number;
  leading: boolean;
  hasAnalytics: boolean;
}) {
  const declaredWinner = post.qualityNotes?.includes("Thắng");
  const declaredLoser = post.qualityNotes?.includes("Thua");
  const highlighted = declaredWinner || leading;

  return (
    <div
      className={`rounded-[12px] border p-4 transition-colors ${
        declaredWinner
          ? "border-[var(--accent)] bg-[var(--accent-soft)]"
          : highlighted
            ? "border-[var(--accent)] bg-[var(--bg-subtle)]"
            : "border-[var(--border)] bg-[var(--bg-subtle)]"
      } ${declaredLoser ? "opacity-60" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`flex items-center gap-1.5 text-[12.5px] font-bold ${highlighted ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"}`}>
          Phiên bản {letter}
          {declaredWinner && <Trophy size={13} weight="fill" aria-label="Phiên bản đã chốt thắng" />}
        </span>
        {hasAnalytics && (
          <span
            className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold tabular-nums ${
              leading ? "bg-[var(--accent)] text-[var(--accent-foreground)]" : "bg-[var(--bg-card)] text-[var(--text-muted)]"
            }`}
          >
            {score} điểm
          </span>
        )}
      </div>

      <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--text)]">{truncate(post.caption, 180)}</p>

      {post.analytics ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { label: "Thích", value: post.analytics.likes },
            { label: "Bình luận", value: post.analytics.comments },
            { label: "Chia sẻ", value: post.analytics.shares },
          ].map((metric) => (
            <div key={metric.label} className="rounded-[9px] bg-[var(--bg-card)] p-2 text-center">
              <p className="text-[15px] font-extrabold tabular-nums leading-none">{metric.value}</p>
              <p className="mt-1 text-[10px] text-[var(--text-muted)]">{metric.label}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-[9px] bg-[var(--bg-card)] py-2 text-center text-[11px] text-[var(--text-muted)]">
          {post.status === "published" ? "Đã đăng, chưa đồng bộ số liệu" : "Chưa đăng nên chưa có số liệu"}
        </p>
      )}
    </div>
  );
}
