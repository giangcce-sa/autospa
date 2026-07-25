"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useActivePage } from "@/contexts/ActivePageContext";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { ChatCircle, Robot, Plus, Trash, Warning, CheckCircle, Sparkle, ArrowsClockwise, FacebookLogo } from "@phosphor-icons/react";
import { truncate } from "@/lib/utils";

interface CommentRule { id: string; trigger: string; reply: string; isActive: boolean; }
interface PostOption { id: string; caption: string; }
interface Comment {
  id: string; authorName: string; content: string; sentiment: string | null;
  isReplied: boolean; autoReply: string | null; isAlert: boolean; fbCommentId: string | null;
  createdAt: string; post: { caption: string };
}

const SentimentBadge = ({ s }: { s: string | null }) => {
  if (s === "positive") return <Badge variant="success">Tích cực</Badge>;
  if (s === "negative") return <Badge variant="danger">Tiêu cực</Badge>;
  return <Badge variant="neutral">Trung lập</Badge>;
};

const SYNC_INTERVAL = 2 * 60 * 1000;

export function AutoCommentManager({ canMutate = true }: { canMutate?: boolean }) {
  const { selectedPageId, selectedPage } = useActivePage();
  const [comments, setComments] = useState<Comment[]>([]);
  const [rules, setRules] = useState<CommentRule[]>([]);
  const [posts, setPosts] = useState<PostOption[]>([]);
  const [selectedPostId, setSelectedPostId] = useState("");
  const [alertCount, setAlertCount] = useState(0);
  const [newRule, setNewRule] = useState({ trigger: "", reply: "" });
  const [simForm, setSimForm] = useState({ authorName: "Khách hàng test", content: "" });
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [tab, setTab] = useState<"comments" | "rules">("comments");
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [lastSyncCount, setLastSyncCount] = useState<number | null>(null);
  const syncingRef = useRef(false);

  const load = useCallback((pageId: string) => {
    const query = new URLSearchParams({ facebookPageId: pageId });
    return fetch(`/api/comments?${query.toString()}`).then((r) => r.json()).then((res) => {
      if (res.data) {
        setComments(res.data.comments);
        setRules(res.data.rules);
        setPosts(res.data.posts);
        setSelectedPostId((current) => res.data.posts.some((post: PostOption) => post.id === current) ? current : (res.data.posts[0]?.id ?? ""));
        setAlertCount(res.data.alertCount);
      }
    });
  }, []);

  const syncFb = useCallback(async (silent = false) => {
    if (!canMutate || !selectedPageId || syncingRef.current) return;
    syncingRef.current = true;
    if (!silent) setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync-fb", facebookPageId: selectedPageId }),
      });
      const data = await res.json();
      if (!data.success) {
        if (!silent) setSyncError(data.error);
      } else {
        setLastSynced(new Date());
        setLastSyncCount(data.data.newCount);
        if (data.data.newCount > 0) await load(selectedPageId);
      }
    } catch {
      if (!silent) setSyncError("Không thể kết nối");
    } finally {
      syncingRef.current = false;
      if (!silent) setSyncing(false);
    }
  }, [canMutate, load, selectedPageId]);

  useEffect(() => {
    if (!selectedPageId) {
      setComments([]);
      setRules([]);
      setPosts([]);
      setSelectedPostId("");
      return;
    }
    load(selectedPageId);
    if (!canMutate) return;
    const interval = setInterval(() => syncFb(true), SYNC_INTERVAL);
    return () => clearInterval(interval);
  }, [canMutate, load, selectedPageId, syncFb]);

  const addRule = async () => {
    if (!selectedPageId || !newRule.trigger || !newRule.reply) return;
    await fetch("/api/comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "add-rule", facebookPageId: selectedPageId, ...newRule }) });
    setNewRule({ trigger: "", reply: "" });
    load(selectedPageId);
  };

  const toggleRule = async (id: string) => {
    if (!selectedPageId) return;
    await fetch("/api/comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "toggle-rule", facebookPageId: selectedPageId, ruleId: id }) });
    load(selectedPageId);
  };

  const deleteRule = async (id: string) => {
    if (!selectedPageId) return;
    await fetch("/api/comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete-rule", facebookPageId: selectedPageId, ruleId: id }) });
    load(selectedPageId);
  };

  const simulate = async () => {
    if (!selectedPageId || !selectedPostId || !simForm.content.trim()) return;
    await fetch("/api/comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "simulate", facebookPageId: selectedPageId, postId: selectedPostId, ...simForm }) });
    setSimForm((p) => ({ ...p, content: "" }));
    load(selectedPageId);
  };

  const aiReply = async (id: string) => {
    if (!selectedPageId) return;
    setLoadingId(id + "_ai");
    try {
      await fetch("/api/comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "ai-reply", facebookPageId: selectedPageId, commentId: id }) });
      load(selectedPageId);
    } finally { setLoadingId(null); }
  };

  const sendFbReply = async (id: string) => {
    if (!selectedPageId) return;
    setLoadingId(id + "_send");
    try {
      const res = await fetch("/api/comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "send-fb-reply", facebookPageId: selectedPageId, commentId: id }) });
      const data = await res.json();
      if (!data.success) alert(data.error);
      else load(selectedPageId);
    } finally { setLoadingId(null); }
  };

  const syncLabel = lastSynced
    ? `${Math.round((Date.now() - lastSynced.getTime()) / 60000)} phút trước${lastSyncCount !== null ? ` · ${lastSyncCount} bình luận mới` : ""}`
    : "Chưa đồng bộ";

  const syncErrorLabel =
    syncError === "FB_NO_PERMISSION" ? "Token thiếu quyền pages_read_engagement — cập nhật trong Cài đặt" :
    syncError === "FB_TOKEN_INVALID" ? "Token không hợp lệ — vào Cài đặt để cập nhật" :
    syncError === "Chưa cấu hình Facebook Page" ? "Chưa cấu hình Facebook trong Cài đặt" :
    syncError;

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs flex-wrap" style={{ background: "var(--bg-subtle)" }}>
        <span className="flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
          <FacebookLogo size={11} color="#1877F2" /> {selectedPage?.pageName ?? "Hãy chọn Facebook Page"}
        </span>
        <div className="flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: lastSynced ? "var(--accent)" : "var(--text-muted)" }} />
          Đồng bộ: {syncLabel}
        </div>
        {canMutate && (
          <Button size="sm" variant="secondary" loading={syncing} disabled={!selectedPageId} onClick={() => syncFb(false)}>
            <ArrowsClockwise size={11} /> Đồng bộ ngay
          </Button>
        )}
        {syncError && <span style={{ color: "var(--rose)" }}>{syncErrorLabel}</span>}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <p className="text-2xl font-bold" style={{ color: "var(--text)" }}>{comments.length}</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Tổng bình luận</p>
        </Card>
        <Card>
          <p className="text-2xl font-bold" style={{ color: "var(--accent)" }}>{comments.filter((c) => c.isReplied).length}</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Đã trả lời</p>
        </Card>
        <Card>
          <p className="text-2xl font-bold" style={{ color: "var(--rose)" }}>{alertCount}</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Cần chú ý</p>
        </Card>
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant={tab === "comments" ? "primary" : "secondary"} onClick={() => setTab("comments")}>
          <ChatCircle size={13} /> Bình luận
          {alertCount > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px]" style={{ background: "var(--rose)", color: "white" }}>{alertCount}</span>}
        </Button>
        <Button size="sm" variant={tab === "rules" ? "primary" : "secondary"} onClick={() => setTab("rules")}>
          <Robot size={13} /> Quy tắc tự động
        </Button>
      </div>

      {tab === "comments" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-2">
            {comments.length === 0 ? (
              <Card><p className="text-xs text-center py-8" style={{ color: "var(--text-muted)" }}>Chưa có bình luận. Nhấn "Đồng bộ ngay" hoặc dùng form test.</p></Card>
            ) : (
              comments.map((c) => (
                <Card key={c.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-medium" style={{ color: "var(--text)" }}>{c.authorName}</span>
                        <SentimentBadge s={c.sentiment} />
                        {c.fbCommentId
                          ? <span className="flex items-center gap-0.5 text-[10px]" style={{ color: "#1877F2" }}><FacebookLogo size={10} /> Thật</span>
                          : <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Test</span>}
                        {c.isAlert && <Warning size={12} style={{ color: "var(--rose)" }} weight="fill" />}
                        {c.isReplied && <CheckCircle size={12} style={{ color: "var(--accent)" }} weight="fill" />}
                      </div>
                      <p className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>{c.content}</p>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Bài: {truncate(c.post.caption, 40)}</p>
                      {c.autoReply && (
                        <div className="mt-2 p-2 rounded-lg flex items-start gap-1.5" style={{ background: "var(--accent-light)" }}>
                          <CheckCircle size={11} style={{ color: "var(--accent)" }} weight="fill" className="mt-0.5 shrink-0" />
                          <p className="text-[11px]" style={{ color: "var(--accent)" }}>{c.autoReply}</p>
                        </div>
                      )}
                    </div>
                    {canMutate && (
                      <div className="flex flex-col gap-1 shrink-0">
                        {!c.autoReply && (
                          <Button size="sm" variant="secondary" loading={loadingId === c.id + "_ai"} onClick={() => aiReply(c.id)}>
                            <Sparkle size={11} /> AI soạn
                          </Button>
                        )}
                        {c.autoReply && !c.isReplied && c.fbCommentId && (
                          <Button size="sm" loading={loadingId === c.id + "_send"} onClick={() => sendFbReply(c.id)}>
                            <FacebookLogo size={11} /> Gửi
                          </Button>
                        )}
                        {c.autoReply && !c.isReplied && (
                          <Button size="sm" variant="secondary" loading={loadingId === c.id + "_ai"} onClick={() => aiReply(c.id)}>
                            <Sparkle size={11} /> Soạn lại
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>

          {canMutate && (
            <Card>
              <CardHeader><CardTitle>Mô phỏng bình luận</CardTitle></CardHeader>
              <div className="space-y-2">
                <select
                  aria-label="Bài viết mô phỏng"
                  className="w-full px-2 py-2 rounded border text-xs outline-none"
                  style={{ background: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text)" }}
                  value={selectedPostId}
                  onChange={(event) => setSelectedPostId(event.target.value)}
                >
                  <option value="">Chọn bài viết</option>
                  {posts.map((post) => <option key={post.id} value={post.id}>{truncate(post.caption, 60)}</option>)}
                </select>
                <Input label="Tên" value={simForm.authorName} onChange={(e) => setSimForm({ ...simForm, authorName: e.target.value })} />
                <Textarea label="Nội dung bình luận" rows={3} placeholder="Giá dịch vụ bao nhiêu?" value={simForm.content} onChange={(e) => setSimForm({ ...simForm, content: e.target.value })} />
                <Button size="sm" onClick={simulate} disabled={!selectedPostId} className="w-full">Gửi test</Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {tab === "rules" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {canMutate && (
            <Card>
              <CardHeader><CardTitle>Thêm quy tắc mới</CardTitle></CardHeader>
              <div className="space-y-2">
                <Input label="Từ khoá kích hoạt" placeholder="VD: giá, bao nhiêu, chi phí" value={newRule.trigger} onChange={(e) => setNewRule({ ...newRule, trigger: e.target.value })} hint="Nếu comment chứa từ này → tự động trả lời" />
                <Textarea label="Câu trả lời tự động" rows={3} placeholder="Cảm ơn bạn đã quan tâm! Inbox để được tư vấn..." value={newRule.reply} onChange={(e) => setNewRule({ ...newRule, reply: e.target.value })} />
                <Button size="sm" onClick={addRule} disabled={!selectedPageId} className="w-full"><Plus size={12} /> Thêm quy tắc</Button>
              </div>
            </Card>
          )}

          <div className="space-y-2">
            {rules.length === 0 ? (
              <Card><p className="text-xs text-center py-8" style={{ color: "var(--text-muted)" }}>Chưa có quy tắc nào.</p></Card>
            ) : (
              rules.map((r) => (
                <Card key={r.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] px-2 py-0.5 rounded font-mono" style={{ background: "var(--bg-subtle)", color: "var(--text-secondary)" }}>"{r.trigger}"</span>
                        <Badge variant={r.isActive ? "success" : "neutral"}>{r.isActive ? "Bật" : "Tắt"}</Badge>
                      </div>
                      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{truncate(r.reply, 80)}</p>
                    </div>
                    {canMutate && (
                      <div className="flex gap-1 shrink-0">
                        <Button size="sm" variant="secondary" onClick={() => toggleRule(r.id)}>{r.isActive ? "Tắt" : "Bật"}</Button>
                        <Button size="sm" variant="danger" onClick={() => deleteRule(r.id)}><Trash size={11} /></Button>
                      </div>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
