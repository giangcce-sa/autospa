"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Bell, Warning, Fire, TrendUp, ChatCircleDots, Sparkle, CheckCircle } from "@phosphor-icons/react";
import { truncate } from "@/lib/utils";

interface SocialAlert { id: string; type: string; content: string; source: string; severity: string; isRead: boolean; createdAt: string; }
interface Stats { total: number; unread: number; critical: number; high: number; }

const severityBadge = (s: string) => {
  if (s === "critical") return <Badge variant="danger">Nguy hiểm</Badge>;
  if (s === "high") return <Badge variant="warning">Cao</Badge>;
  if (s === "medium") return <Badge variant="info">Trung bình</Badge>;
  return <Badge variant="neutral">Thấp</Badge>;
};

const typeIcon = (t: string) => {
  if (t === "crisis") return <Fire size={13} weight="fill" style={{ color: "var(--rose)" }} />;
  if (t === "review_negative") return <Warning size={13} weight="fill" style={{ color: "var(--amber)" }} />;
  if (t === "trending") return <TrendUp size={13} weight="fill" style={{ color: "var(--accent)" }} />;
  return <ChatCircleDots size={13} weight="fill" style={{ color: "var(--blue)" }} />;
};

export function ListeningDashboard() {
  const [alerts, setAlerts] = useState<SocialAlert[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, unread: 0, critical: 0, high: 0 });
  const [analyzeText, setAnalyzeText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [suggestion, setSuggestion] = useState<{ id: string; text: string } | null>(null);
  const [suggestingId, setSuggestingId] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState("");

  const load = () => fetch("/api/listening").then((r) => r.json()).then((res) => {
    if (res.data) { setAlerts(res.data.alerts); setStats(res.data.stats); }
  });

  useEffect(() => { load(); }, []);

  const analyze = async () => {
    if (!analyzeText.trim()) return;
    setAnalyzing(true);
    try {
      await fetch("/api/listening", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "analyze", content: analyzeText, source: "manual" }) });
      setAnalyzeText(""); load();
    } finally { setAnalyzing(false); }
  };

  const simulate = async () => {
    setSimulating(true);
    try { await fetch("/api/listening", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "simulate" }) }); load(); }
    finally { setSimulating(false); }
  };

  const markRead = async (id: string) => {
    await fetch("/api/listening", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "mark-read", id }) });
    load();
  };

  const markAllRead = async () => {
    await fetch("/api/listening", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "mark-all-read" }) });
    load();
  };

  const getSuggestion = async (id: string) => {
    setSuggestingId(id);
    try {
      const res = await fetch("/api/listening", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "suggest-response", id }) });
      const data = await res.json();
      if (data.data) setSuggestion({ id, text: data.data.response });
    } finally { setSuggestingId(null); }
  };

  const filtered = filterSeverity ? alerts.filter((a) => a.severity === filterSeverity) : alerts;

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><p className="text-2xl font-bold" style={{ color: "var(--text)" }}>{stats.total}</p><p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Tổng cảnh báo</p></Card>
        <Card><p className="text-2xl font-bold" style={{ color: "var(--blue)" }}>{stats.unread}</p><p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Chưa đọc</p></Card>
        <Card><p className="text-2xl font-bold" style={{ color: "var(--rose)" }}>{stats.critical}</p><p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Nguy hiểm</p></Card>
        <Card><p className="text-2xl font-bold" style={{ color: "var(--amber)" }}>{stats.high}</p><p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Mức cao</p></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {["", "critical", "high", "medium", "low"].map((s) => (
                <Button key={s} size="sm" variant={filterSeverity === s ? "primary" : "secondary"} onClick={() => setFilterSeverity(s)}>
                  {s === "" ? "Tất cả" : s === "critical" ? "Nguy hiểm" : s === "high" ? "Cao" : s === "medium" ? "TB" : "Thấp"}
                </Button>
              ))}
            </div>
            {stats.unread > 0 && <Button size="sm" variant="secondary" onClick={markAllRead}><CheckCircle size={12} /> Đọc tất cả</Button>}
          </div>

          {filtered.length === 0 ? (
            <Card><p className="text-xs text-center py-12" style={{ color: "var(--text-muted)" }}>Chưa có cảnh báo. Dùng nút "Mô phỏng" để test.</p></Card>
          ) : (
            filtered.map((a) => (
              <Card key={a.id} style={{ opacity: a.isRead ? 0.7 : 1 }}>
                <div className="flex items-start gap-2">
                  <div className="mt-0.5">{typeIcon(a.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {severityBadge(a.severity)}
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{a.source}</span>
                      {!a.isRead && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />}
                    </div>
                    <p className="text-xs" style={{ color: "var(--text)" }}>{a.content}</p>
                    {suggestion?.id === a.id && (
                      <div className="mt-2 p-2 rounded-lg text-xs" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
                        <p className="font-medium mb-0.5">Gợi ý phản hồi:</p>
                        <p>{suggestion.text}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <Button size="sm" variant="secondary" loading={suggestingId === a.id} onClick={() => getSuggestion(a.id)}><Sparkle size={11} /></Button>
                    {!a.isRead && <Button size="sm" variant="secondary" onClick={() => markRead(a.id)}>Đọc</Button>}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        <div className="space-y-3">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2"><Bell size={14} style={{ color: "var(--amber)" }} weight="fill" /><CardTitle>Phân tích nội dung</CardTitle></div>
            </CardHeader>
            <div className="space-y-2">
              <Textarea rows={4} placeholder="Dán nội dung từ mạng xã hội để AI phân tích..." value={analyzeText} onChange={(e) => setAnalyzeText(e.target.value)} />
              <Button size="sm" onClick={analyze} loading={analyzing} className="w-full"><Sparkle size={12} /> Phân tích AI</Button>
              <Button size="sm" variant="secondary" onClick={simulate} loading={simulating} className="w-full">Mô phỏng cảnh báo</Button>
            </div>
          </Card>

          <Card>
            <CardTitle className="mb-2">Loại cảnh báo</CardTitle>
            <div className="space-y-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
              <div className="flex items-center gap-2"><Fire size={12} style={{ color: "var(--rose)" }} weight="fill" /> <span className="font-medium">Khủng hoảng</span> — tin xấu lan rộng</div>
              <div className="flex items-center gap-2"><Warning size={12} style={{ color: "var(--amber)" }} weight="fill" /> <span className="font-medium">Review tiêu cực</span> — đánh giá xấu</div>
              <div className="flex items-center gap-2"><TrendUp size={12} style={{ color: "var(--accent)" }} weight="fill" /> <span className="font-medium">Xu hướng</span> — trend liên quan</div>
              <div className="flex items-center gap-2"><ChatCircleDots size={12} style={{ color: "var(--blue)" }} weight="fill" /> <span className="font-medium">Đề cập</span> — có người nhắc đến</div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
