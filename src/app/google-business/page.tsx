"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import {
  Star, ArrowsClockwise, PaperPlaneTilt, MagicWand, ChatCircle,
  Megaphone, Eye, PhoneCall, MapPin, Globe, TrendUp, Warning,
  CheckCircle, Trash,
} from "@phosphor-icons/react";

function GoogleIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={11} weight={i <= rating ? "fill" : "regular"} style={{ color: i <= rating ? "#FBBC05" : "var(--border)" }} />
      ))}
    </div>
  );
}

type Tab = "reviews" | "posts" | "insights";
type CTA = "BOOK" | "CALL" | "LEARN_MORE" | "ORDER" | "SHOP" | "SIGN_UP";

interface GReview {
  id: string; authorName: string; authorPhotoUrl: string | null;
  rating: number; comment: string | null; sentiment: string | null;
  reply: string | null; isReplied: boolean; repliedAt: string | null;
  updateTime: string; createdAt: string;
}

interface GPost {
  id: string; summary: string; callToAction: string | null;
  callToActionUrl: string | null; status: string; publishedAt: string | null;
  createdAt: string;
}

interface ReviewStats {
  total: number; avgRating: number; unreplied: number; negative: number;
  byRating: { rating: number; count: number }[];
}

interface Insights {
  views: number; searches: number; websiteClicks: number;
  callClicks: number; directionRequests: number; period: string;
}

const CTA_LABELS: Record<string, string> = {
  BOOK: "Đặt lịch", CALL: "Gọi ngay", LEARN_MORE: "Tìm hiểu thêm",
  ORDER: "Đặt hàng", SHOP: "Mua sắm", SIGN_UP: "Đăng ký",
};

export default function GoogleBusinessPage() {
  const [tab, setTab] = useState<Tab>("reviews");
  const [reviews, setReviews] = useState<GReview[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [posts, setPosts] = useState<GPost[]>([]);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [noAccount, setNoAccount] = useState(false);

  // Reply state
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [aiReplying, setAiReplying] = useState<string | null>(null);
  const [submittingReply, setSubmittingReply] = useState(false);

  // Post compose
  const [postForm, setPostForm] = useState({ summary: "", callToActionType: "" as CTA | "", callToActionUrl: "", mediaUrl: "" });
  const [creatingPost, setCreatingPost] = useState(false);
  const [postMsg, setPostMsg] = useState("");

  const loadReviews = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/google-business?action=reviews");
    const json = await res.json();
    if (json.success) { setReviews(json.data.reviews); setStats(json.data.stats); }
    setLoading(false);
  }, []);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/google-business?action=posts");
    const json = await res.json();
    if (json.success) setPosts(json.data);
    setLoading(false);
  }, []);

  const loadInsights = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/google-business?action=insights");
    const json = await res.json();
    if (json.success) setInsights(json.data);
    else if (json.message?.includes("Chưa kết nối")) setNoAccount(true);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (tab === "reviews") loadReviews();
    else if (tab === "posts") loadPosts();
    else if (tab === "insights") loadInsights();
  }, [tab, loadReviews, loadPosts, loadInsights]);

  const syncReviews = async () => {
    setSyncing(true);
    const res = await fetch("/api/google-business", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sync-reviews" }),
    });
    const json = await res.json();
    if (json.success) loadReviews();
    else setNoAccount(true);
    setSyncing(false);
  };

  const getAiReply = async (id: string) => {
    setAiReplying(id);
    const res = await fetch("/api/google-business", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ai-reply", reviewDbId: id }),
    });
    const json = await res.json();
    if (json.success) { setReplyText(json.data.reply); setReplyingId(id); }
    setAiReplying(null);
  };

  const submitReply = async (id: string) => {
    if (!replyText.trim()) return;
    setSubmittingReply(true);
    await fetch("/api/google-business", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reply", reviewDbId: id, reply: replyText }),
    });
    setReplyingId(null);
    setReplyText("");
    loadReviews();
    setSubmittingReply(false);
  };

  const deleteReply = async (id: string) => {
    await fetch("/api/google-business", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete-reply", reviewDbId: id }),
    });
    loadReviews();
  };

  const createPost = async () => {
    if (!postForm.summary.trim()) return;
    setCreatingPost(true);
    setPostMsg("");
    const res = await fetch("/api/google-business", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create-post", ...postForm, callToActionType: postForm.callToActionType || undefined }),
    });
    const json = await res.json();
    if (json.success) {
      setPostMsg("✓ Đã đăng lên Google Business Profile");
      setPostForm({ summary: "", callToActionType: "", callToActionUrl: "", mediaUrl: "" });
      loadPosts();
    } else {
      setPostMsg(`✗ ${json.error}`);
    }
    setCreatingPost(false);
  };

  if (noAccount) {
    return (
      <>
        <PageHeader title="Google Business Profile" description="Quản lý đánh giá và đăng cập nhật" />
        <Card>
          <div className="flex flex-col items-center py-8 text-center">
            <GoogleIcon size={32} />
            <p className="text-sm font-semibold mt-3" style={{ color: "var(--text)" }}>Chưa kết nối Google Business</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Vào Cài đặt → Google Business Profile để kết nối</p>
            <a href="/settings" className="mt-4"><Button>Đến Cài đặt</Button></a>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Google Business Profile" description="Quản lý đánh giá, đăng cập nhật và theo dõi hiệu suất" />

      <div className="space-y-4 max-w-5xl">
        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--bg-subtle)" }}>
          {([
            { key: "reviews", label: "Đánh giá", icon: Star },
            { key: "posts", label: "Bài đăng", icon: Megaphone },
            { key: "insights", label: "Insights", icon: TrendUp },
          ] as { key: Tab; label: string; icon: React.ElementType }[]).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[12px] font-medium transition-all"
              style={{
                background: tab === key ? "var(--bg-card)" : "transparent",
                color: tab === key ? "var(--text)" : "var(--text-muted)",
                boxShadow: tab === key ? "var(--shadow-sm)" : "none",
              }}
            >
              <Icon size={13} weight={tab === key ? "fill" : "regular"} />
              {label}
            </button>
          ))}
        </div>

        {/* ── Reviews Tab ── */}
        {tab === "reviews" && (
          <div className="space-y-3">
            {/* Stats + sync */}
            <div className="flex items-center gap-3 flex-wrap">
              <Button variant="secondary" onClick={syncReviews} loading={syncing} size="sm">
                <ArrowsClockwise size={13} /> Đồng bộ reviews
              </Button>
              {stats && (
                <div className="flex items-center gap-4 text-[12px]">
                  <div className="flex items-center gap-1">
                    <Star size={13} weight="fill" style={{ color: "#FBBC05" }} />
                    <span className="font-bold tabular-nums">{stats.avgRating.toFixed(1)}</span>
                    <span style={{ color: "var(--text-muted)" }}>avg · {stats.total} reviews</span>
                  </div>
                  {stats.unreplied > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: "var(--warning-light)", color: "var(--warning)" }}>
                      {stats.unreplied} chưa trả lời
                    </span>
                  )}
                  {stats.negative > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: "var(--danger-light)", color: "var(--danger)" }}>
                      {stats.negative} đánh giá xấu
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Rating distribution */}
            {stats && (
              <Card>
                <div className="flex items-end gap-3">
                  <div className="text-center">
                    <p className="text-4xl font-bold tabular-nums" style={{ color: "var(--text)" }}>{stats.avgRating.toFixed(1)}</p>
                    <div className="flex justify-center mt-1">
                      <StarRating rating={Math.round(stats.avgRating)} />
                    </div>
                    <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>{stats.total} đánh giá</p>
                  </div>
                  <div className="flex-1 space-y-1">
                    {[5, 4, 3, 2, 1].map((r) => {
                      const cnt = stats.byRating.find((b) => b.rating === r)?.count ?? 0;
                      const pct = stats.total > 0 ? Math.round((cnt / stats.total) * 100) : 0;
                      return (
                        <div key={r} className="flex items-center gap-2 text-[10px]">
                          <span className="w-2 text-right" style={{ color: "var(--text-muted)" }}>{r}</span>
                          <Star size={8} weight="fill" style={{ color: "#FBBC05" }} />
                          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-subtle)" }}>
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: r >= 4 ? "#34A853" : r === 3 ? "#FBBC05" : "#EA4335" }} />
                          </div>
                          <span className="w-6 tabular-nums" style={{ color: "var(--text-muted)" }}>{cnt}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>
            )}

            {/* Review list */}
            {loading ? (
              <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-28 rounded-xl" />)}</div>
            ) : reviews.length === 0 ? (
              <Card>
                <p className="text-center text-sm py-6" style={{ color: "var(--text-muted)" }}>
                  Chưa có đánh giá — nhấn "Đồng bộ reviews" để tải từ Google
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {reviews.map((rv) => (
                  <Card key={rv.id}>
                    <div className="flex items-start gap-3">
                      {rv.authorPhotoUrl ? (
                        <img src={rv.authorPhotoUrl} alt="" className="w-8 h-8 rounded-full shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
                          style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}>
                          {rv.authorName[0]?.toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>{rv.authorName}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <StarRating rating={rv.rating} />
                              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                                {new Date(rv.createdAt).toLocaleDateString("vi-VN")}
                              </span>
                              {rv.rating <= 2 && (
                                <Warning size={11} weight="fill" style={{ color: "var(--danger)" }} />
                              )}
                            </div>
                          </div>
                          {rv.isReplied ? (
                            <div className="flex items-center gap-1 text-[10px] shrink-0" style={{ color: "var(--success)" }}>
                              <CheckCircle size={11} weight="fill" />
                              Đã trả lời
                            </div>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full shrink-0" style={{ background: "var(--warning-light)", color: "var(--warning)" }}>
                              Chưa trả lời
                            </span>
                          )}
                        </div>

                        {rv.comment && (
                          <p className="text-xs mt-2 leading-relaxed" style={{ color: "var(--text)" }}>{rv.comment}</p>
                        )}

                        {/* Existing reply */}
                        {rv.isReplied && rv.reply && (
                          <div className="mt-2 pl-3 border-l-2 text-[11px]" style={{ borderColor: "var(--accent)" }}>
                            <p className="font-semibold mb-0.5" style={{ color: "var(--accent)" }}>Phản hồi của bạn:</p>
                            <p style={{ color: "var(--text-muted)" }}>{rv.reply}</p>
                            <button onClick={() => deleteReply(rv.id)} className="mt-1 text-[9px] underline flex items-center gap-0.5"
                              style={{ color: "var(--danger)" }}>
                              <Trash size={9} /> Xóa phản hồi
                            </button>
                          </div>
                        )}

                        {/* Reply composer */}
                        {replyingId === rv.id ? (
                          <div className="mt-2 space-y-1.5">
                            <Textarea
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              rows={3}
                              placeholder="Viết phản hồi..."
                              className="text-xs"
                            />
                            <div className="flex gap-1.5">
                              <Button size="sm" onClick={() => submitReply(rv.id)} loading={submittingReply}>
                                <PaperPlaneTilt size={11} /> Gửi
                              </Button>
                              <Button size="sm" variant="secondary" onClick={() => { setReplyingId(null); setReplyText(""); }}>
                                Hủy
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2 flex gap-1.5">
                            <Button size="sm" variant="secondary" onClick={() => getAiReply(rv.id)} loading={aiReplying === rv.id}>
                              <MagicWand size={11} /> AI Reply
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => { setReplyingId(rv.id); setReplyText(rv.reply ?? ""); }}>
                              <ChatCircle size={11} /> {rv.isReplied ? "Chỉnh sửa" : "Trả lời thủ công"}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Posts Tab ── */}
        {tab === "posts" && (
          <div className="space-y-3">
            {/* Compose new post */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Megaphone size={14} weight="fill" style={{ color: "var(--accent)" }} />
                  Đăng cập nhật lên Google Business
                </CardTitle>
              </CardHeader>
              <div className="space-y-2">
                <Textarea
                  value={postForm.summary}
                  onChange={(e) => setPostForm((f) => ({ ...f, summary: e.target.value }))}
                  placeholder="Nội dung cập nhật (khuyến mãi, thông báo, sự kiện...)..."
                  rows={4}
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold mb-1 block" style={{ color: "var(--text-muted)" }}>CALL TO ACTION</label>
                    <select
                      value={postForm.callToActionType}
                      onChange={(e) => setPostForm((f) => ({ ...f, callToActionType: e.target.value as CTA | "" }))}
                      className="w-full text-xs rounded-lg px-2.5 py-1.5 border outline-none"
                      style={{ borderColor: "var(--border)", background: "var(--bg-subtle)", color: "var(--text)" }}
                    >
                      <option value="">Không có</option>
                      {Object.entries(CTA_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold mb-1 block" style={{ color: "var(--text-muted)" }}>URL (nếu có CTA)</label>
                    <input
                      type="url"
                      value={postForm.callToActionUrl}
                      onChange={(e) => setPostForm((f) => ({ ...f, callToActionUrl: e.target.value }))}
                      placeholder="https://..."
                      className="w-full text-xs rounded-lg px-2.5 py-1.5 border outline-none"
                      style={{ borderColor: "var(--border)", background: "var(--bg-subtle)", color: "var(--text)" }}
                    />
                  </div>
                </div>
                <input
                  type="url"
                  value={postForm.mediaUrl}
                  onChange={(e) => setPostForm((f) => ({ ...f, mediaUrl: e.target.value }))}
                  placeholder="URL ảnh (tùy chọn, phải public)"
                  className="w-full text-xs rounded-lg px-2.5 py-1.5 border outline-none"
                  style={{ borderColor: "var(--border)", background: "var(--bg-subtle)", color: "var(--text)" }}
                />
                <Button onClick={createPost} loading={creatingPost} disabled={!postForm.summary.trim()}>
                  <PaperPlaneTilt size={13} weight="fill" /> Đăng lên Google Business
                </Button>
                {postMsg && (
                  <p className="text-xs" style={{ color: postMsg.startsWith("✓") ? "var(--success)" : "var(--danger)" }}>
                    {postMsg}
                  </p>
                )}
              </div>
            </Card>

            {/* Post history */}
            {loading ? (
              <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="skeleton h-20 rounded-xl" />)}</div>
            ) : posts.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: "var(--text-muted)" }}>Chưa có bài đăng nào</p>
            ) : (
              <div className="space-y-2">
                {posts.map((p) => (
                  <Card key={p.id}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs" style={{ color: "var(--text)" }}>{p.summary}</p>
                        {p.callToAction && (
                          <div className="mt-1 flex items-center gap-1 text-[10px]" style={{ color: "var(--accent)" }}>
                            <Globe size={10} />
                            <span>{CTA_LABELS[p.callToAction] ?? p.callToAction}</span>
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{
                          background: p.status === "published" ? "var(--success-light)" : "var(--bg-subtle)",
                          color: p.status === "published" ? "var(--success)" : "var(--text-muted)",
                        }}>
                          {p.status}
                        </span>
                        {p.publishedAt && (
                          <p className="text-[9px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                            {new Date(p.publishedAt).toLocaleDateString("vi-VN")}
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Insights Tab ── */}
        {tab === "insights" && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button variant="secondary" size="sm" onClick={loadInsights} loading={loading}>
                <ArrowsClockwise size={13} /> Làm mới
              </Button>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{[1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>
            ) : insights ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: "Lượt xem hồ sơ", value: insights.views, icon: Eye, color: "#4285F4" },
                    { label: "Lượt tìm kiếm", value: insights.searches, icon: TrendUp, color: "#34A853" },
                    { label: "Click website", value: insights.websiteClicks, icon: Globe, color: "var(--accent)" },
                    { label: "Cuộc gọi", value: insights.callClicks, icon: PhoneCall, color: "var(--premium)" },
                    { label: "Chỉ đường", value: insights.directionRequests, icon: MapPin, color: "var(--warning)" },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <Card key={label}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2" style={{ background: `${color}18` }}>
                        <Icon size={16} style={{ color }} weight="fill" />
                      </div>
                      <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--text)" }}>
                        {value.toLocaleString("vi-VN")}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{label}</p>
                    </Card>
                  ))}
                </div>
                <p className="text-[10px] text-center" style={{ color: "var(--text-muted)" }}>{insights.period}</p>
              </>
            ) : (
              <Card>
                <p className="text-center text-sm py-6" style={{ color: "var(--text-muted)" }}>
                  Cần kết nối Google Business và chọn location để xem insights.<br />
                  <a href="/settings" className="underline" style={{ color: "var(--accent)" }}>Cài đặt →</a>
                </p>
              </Card>
            )}
          </div>
        )}
      </div>
    </>
  );
}
