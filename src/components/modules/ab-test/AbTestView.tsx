"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { truncate } from "@/lib/utils";
import { Trophy, ArrowsSplit, ChatsTeardrop, CaretDown } from "@phosphor-icons/react";

interface Analytics { likes: number; comments: number; shares: number; reach: number; }
interface Post { id: string; caption: string; status: string; qualityNotes: string | null; analytics: Analytics | null; }
interface Group { abGroupId: string; posts: Post[]; createdAt: string; }

function engagementScore(a: Analytics | null) {
  if (!a) return 0;
  return (a.likes ?? 0) + (a.comments ?? 0) * 2 + (a.shares ?? 0) * 3;
}

interface JudgeTurn { speaker: string; provider: "claude" | "openai"; content: string; }
interface JudgeResult { synthesis: string; turns: JudgeTurn[]; }

export function AbTestView() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [declaring, setDeclaring] = useState<string | null>(null);
  const [judging, setJudging] = useState<string | null>(null);
  const [judgeResults, setJudgeResults] = useState<Record<string, JudgeResult>>({});
  const [expandedDebate, setExpandedDebate] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ab-test");
      const data = await res.json();
      if (data.success) setGroups(data.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const runJudge = async (abGroupId: string) => {
    setJudging(abGroupId);
    try {
      const res = await fetch("/api/ab-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "judge", abGroupId }),
      });
      const data = await res.json();
      if (data.success) {
        setJudgeResults((prev) => ({ ...prev, [abGroupId]: { synthesis: data.data.synthesis, turns: data.data.turns } }));
        setExpandedDebate((prev) => ({ ...prev, [abGroupId]: false }));
      }
    } finally { setJudging(null); }
  };

  const declareWinner = async (winnerId: string, abGroupId: string) => {
    setDeclaring(winnerId);
    try {
      await fetch("/api/ab-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "declare-winner", winnerId, abGroupId }),
      });
      await load();
    } finally { setDeclaring(null); }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-4xl">
        {[1,2].map(i => <div key={i} className="skeleton h-48 rounded-xl" />)}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center max-w-sm mx-auto">
        <ArrowsSplit size={36} className="mb-3 opacity-20" style={{ color: "var(--text-secondary)" }} />
        <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>Chưa có A/B test nào</p>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          Viết bài trong Viết bài → nhấn nút <strong>A/B Test</strong> để tạo hai phiên bản caption.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-4xl">
      {groups.map((group) => {
        const [postA, postB] = group.posts;
        if (!postA || !postB) return null;

        const scoreA = engagementScore(postA.analytics);
        const scoreB = engagementScore(postB.analytics);
        const hasAnalytics = postA.analytics || postB.analytics;
        const winner = hasAnalytics ? (scoreA >= scoreB ? postA.id : postB.id) : null;
        const isDeclared = group.posts.some((p) => p.qualityNotes?.includes("Thắng") || p.qualityNotes?.includes("Thua"));

        return (
          <Card key={group.abGroupId}>
            <CardHeader>
              <div>
                <CardTitle>A/B Test #{group.abGroupId.slice(0, 6)}</CardTitle>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {new Date(group.createdAt).toLocaleDateString("vi-VN")}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => runJudge(group.abGroupId)}
                  loading={judging === group.abGroupId}
                >
                  <ChatsTeardrop size={12} weight="fill" /> AI Council Judge
                </Button>
                {!isDeclared && winner && (
                  <Button
                    size="sm"
                    onClick={() => declareWinner(winner, group.abGroupId)}
                    loading={declaring === winner}
                  >
                    <Trophy size={12} weight="fill" /> Chốt thắng
                  </Button>
                )}
              </div>
            </CardHeader>

            {judgeResults[group.abGroupId] && (
              <div className="mx-5 mb-4 rounded-xl p-4" style={{ background: "var(--accent-light)", border: "1px solid var(--accent)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <ChatsTeardrop size={14} weight="fill" style={{ color: "var(--accent)" }} />
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--accent)" }}>
                    Phán quyết của AI Council
                  </p>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text)" }}>
                  {judgeResults[group.abGroupId].synthesis}
                </p>
                <button
                  onClick={() => setExpandedDebate((prev) => ({ ...prev, [group.abGroupId]: !prev[group.abGroupId] }))}
                  className="flex items-center gap-1 mt-3 text-[11px] font-medium transition-opacity hover:opacity-80"
                  style={{ color: "var(--accent)" }}
                >
                  {expandedDebate[group.abGroupId] ? "Ẩn" : "Xem"} cuộc tranh luận đầy đủ
                  <CaretDown size={10} style={{ transform: expandedDebate[group.abGroupId] ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }} />
                </button>
                {expandedDebate[group.abGroupId] && (
                  <div className="mt-3 space-y-2">
                    {judgeResults[group.abGroupId].turns.map((t, i) => (
                      <div
                        key={i}
                        className="rounded-lg p-2.5 text-xs"
                        style={{
                          background: "var(--bg-card)",
                          borderLeft: `3px solid ${t.provider === "claude" ? "var(--accent)" : "var(--blue)"}`,
                        }}
                      >
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: t.provider === "claude" ? "var(--accent)" : "var(--blue)" }}>
                          {t.speaker}
                        </p>
                        <p className="leading-snug" style={{ color: "var(--text-secondary)" }}>{t.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              {[postA, postB].map((post, idx) => {
                const score = engagementScore(post.analytics);
                const isWinner = winner === post.id && hasAnalytics;
                const isDeclaredWinner = post.qualityNotes?.includes("Thắng");
                const isDeclaredLoser = post.qualityNotes?.includes("Thua");

                return (
                  <div
                    key={post.id}
                    className="rounded-xl p-4 border"
                    style={{
                      borderColor: isDeclaredWinner ? "var(--accent)" : isDeclaredLoser ? "var(--border)" : isWinner ? "var(--accent)" : "var(--border)",
                      background: isDeclaredWinner ? "rgba(45,106,79,0.06)" : "var(--bg-subtle)",
                      opacity: isDeclaredLoser ? 0.6 : 1,
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold" style={{ color: isDeclaredWinner || isWinner ? "var(--accent)" : "var(--text-secondary)" }}>
                        Phiên bản {String.fromCharCode(65 + idx)}
                        {isDeclaredWinner && " 🏆"}
                      </span>
                      {hasAnalytics && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: isWinner ? "var(--accent)" : "var(--bg-card)", color: isWinner ? "white" : "var(--text-muted)" }}>
                          {score} điểm
                        </span>
                      )}
                    </div>
                    <p className="text-xs leading-relaxed mb-3" style={{ color: "var(--text)" }}>
                      {truncate(post.caption, 150)}
                    </p>
                    {post.analytics ? (
                      <div className="grid grid-cols-3 gap-2 text-center">
                        {[
                          { label: "Thích", value: post.analytics.likes },
                          { label: "Bình luận", value: post.analytics.comments },
                          { label: "Chia sẻ", value: post.analytics.shares },
                        ].map(({ label, value }) => (
                          <div key={label} className="rounded-lg p-2" style={{ background: "var(--bg-card)" }}>
                            <p className="text-sm font-bold" style={{ color: "var(--text)" }}>{value}</p>
                            <p className="text-[9px]" style={{ color: "var(--text-muted)" }}>{label}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-center py-2" style={{ color: "var(--text-muted)" }}>
                        {post.status === "published" ? "Chưa có dữ liệu analytics" : "Chưa đăng"}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
