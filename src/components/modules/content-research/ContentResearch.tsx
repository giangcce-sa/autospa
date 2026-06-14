"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import {
  Sparkle, CalendarBlank, Trash, Check,
  ArrowsClockwise, Robot, Clock,
} from "@phosphor-icons/react";

interface DraftPost {
  id: string;
  caption: string;
  hashtags: string | null;
  postType: string;
  tone: string;
  scheduledAt: string | null;
  qualityNotes: string | null;
  createdAt: string;
}

const POST_TYPE_LABELS: Record<string, string> = {
  service: "Dịch vụ",
  promotion: "Ưu đãi",
  educational: "Kiến thức",
  testimonial: "Đánh giá",
  behind_scenes: "Hậu trường",
};

const TONE_LABELS: Record<string, string> = {
  friendly: "Thân thiện",
  professional: "Chuyên nghiệp",
  emotional: "Cảm xúc",
  humorous: "Vui vẻ",
};

function extractTopic(notes: string | null): string {
  if (!notes) return "";
  return notes.replace("AI-RESEARCH:", "").trim();
}

export function ContentResearch() {
  const [drafts, setDrafts] = useState<DraftPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [daysAhead, setDaysAhead] = useState("7");
  const [postsPerDay, setPostsPerDay] = useState("1");
  const [actionId, setActionId] = useState<string | null>(null);
  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ created: number } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/content-research");
    const json = await res.json();
    if (json.success) setDrafts(json.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch("/api/content-research", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "generate", daysAhead: Number(daysAhead), postsPerDay: Number(postsPerDay) }),
      });
      const json = await res.json();
      if (json.success) {
        setResult(json.data);
        await load();
      }
    } finally {
      setGenerating(false);
    }
  };

  const schedule = async (postId: string) => {
    const at = scheduleDate[postId];
    if (!at) return;
    setActionId(postId + "schedule");
    await fetch("/api/content-research", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "schedule", postId, scheduledAt: new Date(at).toISOString() }),
    });
    await load();
    setActionId(null);
    setSchedulingId(null);
  };

  const discard = async (postId: string) => {
    setActionId(postId + "discard");
    await fetch("/api/content-research", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "discard", postId }),
    });
    await load();
    setActionId(null);
  };

  return (
    <div className="space-y-5">
      {/* Generate panel */}
      <Card>
        <CardHeader>
          <CardTitle>Tạo kế hoạch nội dung AI</CardTitle>
          <Robot size={16} style={{ color: "var(--accent)" }} />
        </CardHeader>
        <div className="px-5 pb-5 space-y-4">
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            AI phân tích dịch vụ spa, bài đăng hiệu quả, ngày đặc biệt sắp tới → tự động tạo caption và lên lịch đề xuất.
          </p>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="w-36">
              <Input
                label="Số ngày tới"
                type="number"
                min="1"
                max="30"
                value={daysAhead}
                onChange={(e) => setDaysAhead(e.target.value)}
              />
            </div>
            <div className="w-36">
              <Input
                label="Bài/ngày"
                type="number"
                min="1"
                max="3"
                value={postsPerDay}
                onChange={(e) => setPostsPerDay(e.target.value)}
              />
            </div>
            <Button onClick={generate} loading={generating}>
              <Sparkle size={14} weight="fill" />
              {generating ? "Đang tạo..." : `Tạo ${Number(daysAhead) * Number(postsPerDay)} bài`}
            </Button>
          </div>
          {result && (
            <div className="rounded-lg px-4 py-2.5 text-sm font-medium"
              style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)", color: "var(--accent)" }}>
              Đã tạo {result.created} bài nháp — xem bên dưới để duyệt và lên lịch.
            </div>
          )}
        </div>
      </Card>

      {/* Draft list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>
            Bài nháp AI ({drafts.length})
          </h2>
          <Button size="sm" variant="secondary" onClick={load}>
            <ArrowsClockwise size={13} />
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>Đang tải...</p>
        ) : drafts.length === 0 ? (
          <Card>
            <div className="px-5 py-10 text-center">
              <Sparkle size={32} style={{ color: "var(--text-muted)", margin: "0 auto 8px" }} />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Chưa có bài nháp nào. Nhấn "Tạo kế hoạch" để bắt đầu.
              </p>
            </div>
          </Card>
        ) : (
          drafts.map((draft) => (
            <Card key={draft.id}>
              <div className="p-5 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="info">{POST_TYPE_LABELS[draft.postType] ?? draft.postType}</Badge>
                    <Badge variant="neutral">{TONE_LABELS[draft.tone] ?? draft.tone}</Badge>
                    {draft.scheduledAt && (
                      <Badge variant="warning">
                        <Clock size={10} className="inline mr-1" />
                        {new Date(draft.scheduledAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </Badge>
                    )}
                  </div>
                  <Button size="sm" variant="danger" onClick={() => discard(draft.id)} loading={actionId === draft.id + "discard"}>
                    <Trash size={13} />
                  </Button>
                </div>

                {/* Topic */}
                {draft.qualityNotes && (
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--accent)" }}>
                    {extractTopic(draft.qualityNotes)}
                  </p>
                )}

                {/* Caption */}
                <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "var(--text)" }}>
                  {draft.caption}
                </p>

                {/* Hashtags */}
                {draft.hashtags && (
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{draft.hashtags}</p>
                )}

                {/* Schedule action */}
                {schedulingId === draft.id ? (
                  <div className="flex gap-2 items-center pt-1">
                    <input
                      type="datetime-local"
                      className="text-xs rounded-lg px-3 py-1.5 border"
                      style={{ borderColor: "var(--border)", background: "var(--bg-subtle)", color: "var(--text)" }}
                      value={scheduleDate[draft.id] ?? ""}
                      onChange={(e) => setScheduleDate((prev) => ({ ...prev, [draft.id]: e.target.value }))}
                    />
                    <Button size="sm" onClick={() => schedule(draft.id)} loading={actionId === draft.id + "schedule"}>
                      <Check size={13} /> Lên lịch
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setSchedulingId(null)}>Huỷ</Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setSchedulingId(draft.id);
                      if (draft.scheduledAt) {
                        const d = new Date(draft.scheduledAt);
                        const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                        setScheduleDate((prev) => ({ ...prev, [draft.id]: local }));
                      }
                    }}
                  >
                    <CalendarBlank size={13} /> Lên lịch đăng
                  </Button>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
