"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import {
  Plus, Pencil, Trash, X, ArrowsClockwise, Trophy, FacebookLogo, Eye,
  ThumbsUp, ChatCircle, Share, ArrowSquareOut, Brain, Prohibit,
} from "@phosphor-icons/react";
import { formatDateTime, truncate } from "@/lib/utils";

interface Competitor {
  id: string;
  fbPageId: string;
  name: string;
  notes: string | null;
  accessToken: string | null;
  isActive: boolean;
  lastFetchAt: string | null;
  _count: { posts: number };
}

interface TopPost {
  id: string;
  fbPostId: string;
  message: string;
  likes: number;
  comments: number;
  shares: number;
  learningStatus?: string;
  detectedTopic?: string | null;
  contentFormat?: string | null;
  hookType?: string | null;
  viralLevel?: string;
  publishedAt: string;
  score: number;
  competitor: { name: string };
}

interface CompetitorMemory {
  id: string;
  topTopics: string;
  topServices: string;
  topFormats: string;
  topHooks: string;
  competitorMomentum: string;
  recommendations: string;
  counterPositioning: string | null;
  sampleCount: number;
  confidence: number;
  updatedAt: string;
}

interface MemoryItem {
  label?: string;
  competitor?: string;
  count?: number;
  posts?: number;
  viralPosts?: number;
  score?: number;
}

const BLANK = { fbPageId: "", name: "", notes: "", accessToken: "" };

function parseMemoryItems(value?: string | null): MemoryItem[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseRecommendations(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function CompetitorView() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [topPosts, setTopPosts] = useState<TopPost[]>([]);
  const [memory, setMemory] = useState<CompetitorMemory | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Competitor | null>(null);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState<string | null>(null);
  const [learning, setLearning] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/competitors");
    const data = await res.json();
    if (data.success) {
      setCompetitors(data.data.competitors);
      setTopPosts(data.data.topPosts);
      setMemory(data.data.memory ?? null);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(BLANK);
    setError("");
    setShowForm(true);
  };

  const openEdit = (c: Competitor) => {
    setEditing(c);
    setForm({
      fbPageId: c.fbPageId,
      name: c.name,
      notes: c.notes ?? "",
      accessToken: c.accessToken ?? "",
    });
    setError("");
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.fbPageId.trim() || !form.name.trim()) {
      setError("FB Page ID và tên không được trống");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: editing ? "update" : "create",
          ...(editing ? { id: editing.id } : {}),
          ...form,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setShowForm(false);
      await load();
    } finally { setSaving(false); }
  };

  const fetchNow = async (id: string) => {
    setFetching(id);
    setError("");
    try {
      const res = await fetch("/api/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fetch-now", id }),
      });
      const data = await res.json();
      if (!res.ok) { setError(`Lỗi khi fetch: ${data.error}`); return; }
      await load();
    } finally { setFetching(null); }
  };

  const runLearning = async () => {
    setLearning(true);
    setError("");
    try {
      const res = await fetch("/api/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "learn" }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Không chạy được competitor learning"); return; }
      await load();
    } finally { setLearning(false); }
  };

  const setPostLearningStatus = async (id: string, learningStatus: "approved" | "rejected") => {
    await fetch("/api/competitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set-post-learning-status", id, learningStatus }),
    });
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm("Xóa đối thủ này? Tất cả bài viết đã lưu cũng bị xóa.")) return;
    await fetch("/api/competitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    await load();
  };

  const toggle = async (c: Competitor) => {
    await fetch("/api/competitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", id: c.id, isActive: !c.isActive }),
    });
    await load();
  };

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Top stats */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl px-4 py-2.5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <p className="text-xl font-bold" style={{ color: "var(--text)" }}>{competitors.length}</p>
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Đối thủ theo dõi</p>
          </div>
          <div className="rounded-xl px-4 py-2.5" style={{ background: "var(--blue-light)" }}>
            <p className="text-xl font-bold" style={{ color: "var(--blue)" }}>
              {competitors.reduce((s, c) => s + c._count.posts, 0)}
            </p>
            <p className="text-[10px]" style={{ color: "var(--blue)" }}>Bài đã thu thập</p>
          </div>
        </div>
        <Button onClick={openCreate}>
          <Plus size={14} weight="bold" /> Thêm đối thủ
        </Button>
      </div>

      {error && (
        <div className="text-xs p-3 rounded-xl" style={{ background: "var(--rose-light)", color: "var(--rose)" }}>
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>AI học được gì từ đối thủ</CardTitle>
          <Button size="sm" variant="secondary" onClick={runLearning} loading={learning}>
            <Brain size={12} weight="fill" /> Chạy học
          </Button>
        </CardHeader>
        {!memory ? (
          <div className="py-6 text-center">
            <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>Chưa có competitor memory</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Sync bài đối thủ rồi bấm Chạy học để AI rút ra topic, format, hook và hướng phản ứng.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                ["Topic", parseMemoryItems(memory.topTopics)[0]?.label],
                ["Dịch vụ", parseMemoryItems(memory.topServices)[0]?.label],
                ["Format", parseMemoryItems(memory.topFormats)[0]?.label],
                ["Hook", parseMemoryItems(memory.topHooks)[0]?.label],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg p-3" style={{ background: "var(--bg-subtle)" }}>
                  <p className="text-[10px] uppercase font-semibold" style={{ color: "var(--text-muted)" }}>{label}</p>
                  <p className="text-sm font-semibold mt-1 truncate" style={{ color: "var(--text)" }}>{value || "Chưa rõ"}</p>
                </div>
              ))}
            </div>
            {memory.counterPositioning && (
              <div className="rounded-lg p-3" style={{ background: "var(--accent-light)" }}>
                <p className="text-[10px] uppercase font-semibold mb-1" style={{ color: "var(--accent)" }}>Cách mình nên khác biệt</p>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>{memory.counterPositioning}</p>
              </div>
            )}
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>Đối thủ có momentum</p>
                <div className="space-y-1.5">
                  {parseMemoryItems(memory.competitorMomentum).slice(0, 4).map((item, idx) => (
                    <div key={`${item.competitor}-${idx}`} className="flex justify-between text-xs">
                      <span style={{ color: "var(--text)" }}>{item.competitor}</span>
                      <span style={{ color: "var(--text-muted)" }}>{item.posts ?? 0} bài · {item.viralPosts ?? 0} viral</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>Gợi ý phản ứng</p>
                <div className="space-y-1.5">
                  {parseRecommendations(memory.recommendations).slice(0, 3).map((rec, idx) => (
                    <p key={idx} className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>• {rec}</p>
                  ))}
                </div>
              </div>
            </div>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              Học từ {memory.sampleCount} bài · confidence {Math.round(memory.confidence * 100)}% · cập nhật {formatDateTime(memory.updatedAt)}
            </p>
          </div>
        )}
      </Card>

      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editing ? "Sửa đối thủ" : "Thêm đối thủ"}</CardTitle>
            <button onClick={() => setShowForm(false)}>
              <X size={16} style={{ color: "var(--text-muted)" }} />
            </button>
          </CardHeader>
          <div className="space-y-3">
            <Input
              label="Facebook Page ID"
              placeholder="VD: 123456789012345 (lấy từ URL facebook.com/[name]/about)"
              value={form.fbPageId}
              onChange={(e) => setForm({ ...form, fbPageId: e.target.value })}
              disabled={!!editing}
            />
            <Input
              label="Tên đối thủ"
              placeholder="VD: Spa ABC, Beauty Center XYZ..."
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Textarea
              label="Ghi chú (tùy chọn)"
              placeholder="VD: Đối thủ chính khu vực Q.1, mạnh về trẻ hóa da..."
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
            <Input
              label="Access Token riêng (tùy chọn)"
              placeholder="Để trống → dùng token của FB Page mình"
              value={form.accessToken}
              onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
            />
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setShowForm(false)} className="flex-1">Hủy</Button>
              <Button onClick={handleSave} loading={saving} className="flex-1">
                {editing ? "Lưu" : "Thêm"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Competitor list */}
      {competitors.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <Eye size={36} className="mb-3 opacity-20" style={{ color: "var(--text-secondary)" }} weight="fill" />
            <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>Chưa theo dõi đối thủ nào</p>
            <p className="text-xs mt-1 max-w-sm" style={{ color: "var(--text-muted)" }}>
              Thêm 3-5 page đối thủ để AI biết họ đang đăng gì, bài nào hot — và dùng làm context khi gen content cho bạn.
            </p>
            <Button onClick={openCreate} className="mt-4">
              <Plus size={13} weight="bold" /> Thêm đối thủ đầu tiên
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {competitors.map((c) => (
            <div
              key={c.id}
              className="rounded-xl p-4 flex gap-3"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                opacity: c.isActive ? 1 : 0.55,
              }}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "var(--blue-light)" }}>
                <FacebookLogo size={14} color="#1877F2" weight="fill" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>{c.name}</p>
                  <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{c.fbPageId}</span>
                </div>
                {c.notes && <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>{c.notes}</p>}
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {c._count.posts} bài · Lần cuối fetch: {c.lastFetchAt ? formatDateTime(c.lastFetchAt) : "chưa"}
                </p>
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                <Button size="sm" variant="secondary" onClick={() => fetchNow(c.id)} loading={fetching === c.id}>
                  <ArrowsClockwise size={11} /> Fetch
                </Button>
                <div className="flex gap-1.5">
                  <button onClick={() => toggle(c)} className="text-[10px] px-2 py-1 rounded-lg font-medium"
                    style={c.isActive ? { background: "var(--accent)", color: "white" } : { background: "var(--bg-subtle)", color: "var(--text-muted)" }}>
                    {c.isActive ? "Bật" : "Tắt"}
                  </button>
                  <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg" style={{ background: "var(--bg-subtle)", color: "var(--text-secondary)" }}>
                    <Pencil size={11} />
                  </button>
                  <button onClick={() => remove(c.id)} className="p-1.5 rounded-lg" style={{ background: "var(--bg-subtle)", color: "var(--rose)" }}>
                    <Trash size={11} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Top posts of competitors */}
      {topPosts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top bài viral của đối thủ — 7 ngày qua</CardTitle>
            <Trophy size={15} style={{ color: "var(--amber)" }} weight="fill" />
          </CardHeader>
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {topPosts.map((p, idx) => (
              <div key={p.id} className="py-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5"
                    style={{
                      background: idx < 3 ? "var(--amber)" : "var(--bg-subtle)",
                      color: idx < 3 ? "white" : "var(--text-muted)",
                    }}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
                      {p.competitor.name}
                    </p>
                    <p className="text-sm leading-snug mb-2" style={{ color: "var(--text)" }}>{truncate(p.message, 200)}</p>
                    {(p.detectedTopic || p.contentFormat || p.hookType) && (
                      <div className="flex gap-1.5 flex-wrap mb-2">
                        {[p.detectedTopic, p.contentFormat, p.hookType].filter(Boolean).map((tag) => (
                          <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-[11px]" style={{ color: "var(--text-muted)" }}>
                      <span className="inline-flex items-center gap-1"><ThumbsUp size={11} weight="fill" />{p.likes}</span>
                      <span className="inline-flex items-center gap-1"><ChatCircle size={11} weight="fill" />{p.comments}</span>
                      <span className="inline-flex items-center gap-1"><Share size={11} weight="fill" />{p.shares}</span>
                      <span style={{ color: "var(--accent)" }} className="font-semibold">Score {p.score}</span>
                      <button
                        onClick={() => setPostLearningStatus(p.id, p.learningStatus === "rejected" ? "approved" : "rejected")}
                        className="inline-flex items-center gap-1"
                        style={{ color: p.learningStatus === "rejected" ? "var(--rose)" : "var(--text-muted)" }}
                      >
                        <Prohibit size={10} /> {p.learningStatus === "rejected" ? "Đã bỏ học" : "Không học"}
                      </button>
                      <a
                        href={`https://facebook.com/${p.fbPostId.replace(/_/, "/posts/")}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-0.5 ml-auto"
                      >
                        Xem <ArrowSquareOut size={10} />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="rounded-xl p-4 text-xs space-y-1.5" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
        <p className="font-semibold" style={{ color: "var(--text-secondary)" }}>Lưu ý kỹ thuật</p>
        <ul className="space-y-1" style={{ color: "var(--text-muted)" }}>
          <li>• FB Page ID: lấy từ URL <code className="text-[10px] px-1 rounded" style={{ background: "var(--bg-card)" }}>facebook.com/[tên-page]/about</code> → kéo xuống tìm &ldquo;Page ID&rdquo;</li>
          <li>• Nếu fetch lỗi quyền: cần Page Public Content Access (App Review) hoặc nhập token riêng có quyền đọc page đó</li>
          <li>• Bài đối thủ sẽ được AI tham khảo khi gen content trong <strong>Nghiên cứu AI</strong> — không phải để copy mà để hiểu trend</li>
          <li>• Cron daily-report sẽ tự sync mỗi sáng</li>
        </ul>
      </div>
    </div>
  );
}
