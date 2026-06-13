"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StatusBadge } from "@/components/ui/Badge";
import { ChatCircleDots, Robot, Plus, Check, X, ArrowsClockwise, FacebookLogo } from "@phosphor-icons/react";
import { formatDateTime } from "@/lib/utils";

interface FbPage { id: string; fbPageId: string; pageName: string; isActive: boolean; }
interface Message { id: string; senderName: string; senderId: string; message: string; reply: string | null; isAutoReply: boolean; createdAt: string; }
interface Appointment { id: string; name: string; phone: string | null; service: string | null; preferredAt: string | null; status: string; createdAt: string; }

const SYNC_INTERVAL = 2 * 60 * 1000;

export function InboxView() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [simForm, setSimForm] = useState({ senderName: "", message: "" });
  const [aptForm, setAptForm] = useState({ name: "", phone: "", service: "", preferredAt: "" });
  const [loadingMsg, setLoadingMsg] = useState<string | null>(null);
  const [showAptForm, setShowAptForm] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [lastSyncCount, setLastSyncCount] = useState<number | null>(null);
  const syncingRef = useRef(false);
  const [fbPages, setFbPages] = useState<FbPage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string>("");

  const load = useCallback((pageId?: string) => {
    const query = pageId ? `?facebookPageId=${pageId}` : "";
    return fetch(`/api/inbox${query}`).then((r) => r.json()).then((res) => {
      if (res.data) { setMessages(res.data.messages); setAppointments(res.data.appointments); }
    });
  }, []);

  const syncFb = useCallback(async (silent = false, pageId?: string) => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    if (!silent) setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch("/api/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync-fb", facebookPageId: pageId || undefined }),
      });
      const data = await res.json();
      if (!data.success) {
        if (!silent) setSyncError(data.error);
      } else {
        setLastSynced(new Date());
        setLastSyncCount(data.data.newCount);
        if (data.data.newCount > 0) await load(pageId);
      }
    } catch {
      if (!silent) setSyncError("Không thể kết nối");
    } finally {
      syncingRef.current = false;
      if (!silent) setSyncing(false);
    }
  }, [load]);

  useEffect(() => {
    fetch("/api/facebook-pages").then((r) => r.json()).then((res) => {
      if (res.data) {
        const active = res.data.filter((p: FbPage) => p.isActive);
        setFbPages(active);
      }
    });
    load();
    syncFb(true);
    const interval = setInterval(() => syncFb(true), SYNC_INTERVAL);
    return () => clearInterval(interval);
  }, [load, syncFb]);

  const handleAutoReply = async (msg: Message) => {
    setLoadingMsg(msg.id + "_ai");
    try {
      await fetch("/api/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "auto-reply", messageId: msg.id, senderName: msg.senderName, message: msg.message }),
      });
      load();
    } finally { setLoadingMsg(null); }
  };

  const handleSendFbReply = async (msg: Message) => {
    setLoadingMsg(msg.id + "_send");
    try {
      const res = await fetch("/api/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send-fb-reply", messageId: msg.id }),
      });
      const data = await res.json();
      if (!data.success) alert(data.error);
      else load();
    } finally { setLoadingMsg(null); }
  };

  const handleSimulate = async () => {
    if (!simForm.message.trim()) return;
    await fetch("/api/inbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "simulate-message", ...simForm }) });
    setSimForm({ senderName: "", message: "" });
    load();
  };

  const handleSaveApt = async () => {
    if (!aptForm.name.trim()) return;
    await fetch("/api/inbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save-appointment", ...aptForm }) });
    setAptForm({ name: "", phone: "", service: "", preferredAt: "" });
    setShowAptForm(false);
    load();
  };

  const handleUpdateApt = async (id: string, status: string) => {
    await fetch("/api/inbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update-appointment", id, status }) });
    load();
  };

  const isRealMessage = (msg: Message) => !msg.senderId.startsWith("sim_");

  const syncLabel = lastSynced
    ? `${Math.round((Date.now() - lastSynced.getTime()) / 60000)} phút trước${lastSyncCount !== null ? ` · ${lastSyncCount} tin mới` : ""}`
    : "Chưa đồng bộ";

  const syncErrorLabel =
    syncError === "FB_NO_PERMISSION" ? "Token thiếu quyền pages_messaging" :
    syncError === "FB_TOKEN_INVALID" ? "Token không hợp lệ — vào Cài đặt" :
    syncError === "Chưa cấu hình Facebook Page" ? "Chưa cấu hình Facebook trong Cài đặt" :
    syncError;

  return (
    <div className="space-y-3 max-w-5xl">
      {/* Sync bar */}
      <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs flex-wrap" style={{ background: "var(--bg-subtle)" }}>
        {fbPages.length > 1 && (
          <select
            className="px-2 py-1 rounded border text-xs outline-none"
            style={{ background: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text)" }}
            value={selectedPageId}
            onChange={(e) => { setSelectedPageId(e.target.value); load(e.target.value || undefined); }}
          >
            <option value="">Tất cả pages</option>
            {fbPages.map((p) => <option key={p.id} value={p.id}>{p.pageName}</option>)}
          </select>
        )}
        {fbPages.length === 1 && (
          <span className="flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
            <FacebookLogo size={11} color="#1877F2" /> {fbPages[0].pageName}
          </span>
        )}
        <div className="flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: lastSynced ? "var(--accent)" : "var(--text-muted)" }} />
          Đồng bộ: {syncLabel}
        </div>
        <Button size="sm" variant="secondary" loading={syncing} onClick={() => syncFb(false, selectedPageId || undefined)}>
          <ArrowsClockwise size={11} /> Đồng bộ ngay
        </Button>
        {syncError && <span style={{ color: "var(--rose)" }}>{syncErrorLabel}</span>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ChatCircleDots size={14} style={{ color: "var(--accent)" }} />
                <CardTitle>Tin nhắn ({messages.length})</CardTitle>
              </div>
            </CardHeader>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {messages.length === 0 ? (
                <p className="text-xs text-center py-8" style={{ color: "var(--text-muted)" }}>Chưa có tin nhắn. Nhấn "Đồng bộ ngay" để lấy từ Facebook.</p>
              ) : messages.map((msg) => (
                <div key={msg.id} className="p-3 rounded-lg space-y-2" style={{ background: "var(--bg-subtle)" }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <p className="text-xs font-medium" style={{ color: "var(--text)" }}>{msg.senderName}</p>
                        {isRealMessage(msg)
                          ? <span className="flex items-center gap-0.5 text-[10px]" style={{ color: "#1877F2" }}><FacebookLogo size={9} /> Thật</span>
                          : <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Test</span>}
                      </div>
                      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{msg.message}</p>
                    </div>
                    {!msg.reply && (
                      <Button size="sm" onClick={() => handleAutoReply(msg)} loading={loadingMsg === msg.id + "_ai"}>
                        <Robot size={11} /> AI soạn
                      </Button>
                    )}
                  </div>
                  {msg.reply && (
                    <div className="p-2 rounded" style={{ background: "var(--accent-light)" }}>
                      <p className="text-[10px] font-medium mb-0.5 flex items-center gap-1" style={{ color: "var(--accent)" }}>
                        <Robot size={10} /> Trả lời AI
                      </p>
                      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{msg.reply}</p>
                      {isRealMessage(msg) && (
                        <Button size="sm" className="mt-2" loading={loadingMsg === msg.id + "_send"} onClick={() => handleSendFbReply(msg)}>
                          <FacebookLogo size={11} /> Gửi qua Messenger
                        </Button>
                      )}
                    </div>
                  )}
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{formatDateTime(msg.createdAt)}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t space-y-2" style={{ borderColor: "var(--border)" }}>
              <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Mô phỏng tin nhắn mới</p>
              <Input placeholder="Tên khách" value={simForm.senderName} onChange={(e) => setSimForm({ ...simForm, senderName: e.target.value })} />
              <div className="flex gap-2">
                <Input placeholder="Nội dung tin nhắn..." value={simForm.message} onChange={(e) => setSimForm({ ...simForm, message: e.target.value })} className="flex-1" />
                <Button onClick={handleSimulate} size="sm"><Plus size={12} /></Button>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Yêu cầu đặt lịch ({appointments.length})</CardTitle>
              <Button size="sm" onClick={() => setShowAptForm(!showAptForm)}>
                <Plus size={12} /> Thêm
              </Button>
            </CardHeader>
            {showAptForm && (
              <div className="mb-3 p-3 rounded-lg space-y-2" style={{ background: "var(--bg-subtle)" }}>
                <Input placeholder="Tên khách *" value={aptForm.name} onChange={(e) => setAptForm({ ...aptForm, name: e.target.value })} />
                <Input placeholder="Số điện thoại" value={aptForm.phone} onChange={(e) => setAptForm({ ...aptForm, phone: e.target.value })} />
                <Input placeholder="Dịch vụ muốn làm" value={aptForm.service} onChange={(e) => setAptForm({ ...aptForm, service: e.target.value })} />
                <Input placeholder="Thời gian mong muốn" value={aptForm.preferredAt} onChange={(e) => setAptForm({ ...aptForm, preferredAt: e.target.value })} />
                <div className="flex gap-2 justify-end">
                  <Button variant="secondary" size="sm" onClick={() => setShowAptForm(false)}>Hủy</Button>
                  <Button size="sm" onClick={handleSaveApt}>Lưu</Button>
                </div>
              </div>
            )}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {appointments.length === 0 ? (
                <p className="text-xs text-center py-8" style={{ color: "var(--text-muted)" }}>Chưa có yêu cầu nào</p>
              ) : appointments.map((apt) => (
                <div key={apt.id} className="p-3 rounded-lg" style={{ background: "var(--bg-subtle)" }}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-xs font-medium" style={{ color: "var(--text)" }}>{apt.name}</p>
                      {apt.phone && <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{apt.phone}</p>}
                      {apt.service && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{apt.service}</p>}
                      {apt.preferredAt && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{apt.preferredAt}</p>}
                    </div>
                    <StatusBadge status={apt.status} />
                  </div>
                  {apt.status === "pending" && (
                    <div className="flex gap-1">
                      <button onClick={() => handleUpdateApt(apt.id, "confirmed")} className="flex items-center gap-1 px-2 py-1 rounded text-xs" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
                        <Check size={10} /> Xác nhận
                      </button>
                      <button onClick={() => handleUpdateApt(apt.id, "cancelled")} className="flex items-center gap-1 px-2 py-1 rounded text-xs" style={{ background: "var(--rose-light)", color: "var(--rose)" }}>
                        <X size={10} /> Hủy
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
