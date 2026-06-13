"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Heart, Sparkle, CheckCircle, Gift, CalendarCheck, ChatCircleText, Megaphone } from "@phosphor-icons/react";

interface CareMsg { id: string; type: string; content: string; status: string; createdAt: string; customer?: { name: string; phone?: string | null } | null; }
interface Stats { pending: number; sent: number; total: number; }
interface Customer { id: string; name: string; phone?: string | null; }

const typeLabels: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  birthday: { label: "Sinh nhật", icon: Gift, color: "var(--amber)" },
  appointment: { label: "Nhắc lịch hẹn", icon: CalendarCheck, color: "var(--blue)" },
  followup: { label: "Hỏi thăm", icon: ChatCircleText, color: "var(--accent)" },
  promo: { label: "Khuyến mãi", icon: Megaphone, color: "var(--rose)" },
};

export function CareManager() {
  const [messages, setMessages] = useState<CareMsg[]>([]);
  const [stats, setStats] = useState<Stats>({ pending: 0, sent: 0, total: 0 });
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState({ type: "birthday", customerId: "", customerName: "", service: "" });
  const [generating, setGenerating] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [preview, setPreview] = useState<{ id: string; content: string } | null>(null);

  const load = () => fetch("/api/care").then((r) => r.json()).then((res) => {
    if (res.data) { setMessages(res.data.messages); setStats(res.data.stats); setCustomers(res.data.customers); }
  });

  useEffect(() => { load(); }, []);

  const generate = async () => {
    setGenerating(true);
    try {
      const selectedCustomer = customers.find((c) => c.id === form.customerId);
      const res = await fetch("/api/care", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", ...form, customerName: selectedCustomer?.name || form.customerName }),
      });
      const data = await res.json();
      if (data.data) { setPreview({ id: data.data.id, content: data.data.content }); load(); }
    } finally { setGenerating(false); }
  };

  const markSent = async (id: string) => {
    await fetch("/api/care", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "mark-sent", id }) });
    if (preview?.id === id) setPreview(null);
    load();
  };

  const bulkBirthday = async () => {
    setBulkLoading(true);
    try {
      const res = await fetch("/api/care", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "bulk-birthday" }) });
      const data = await res.json();
      alert(`Đã tạo ${data.data?.count ?? 0} tin nhắn sinh nhật hôm nay!`);
      load();
    } finally { setBulkLoading(false); }
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="grid grid-cols-3 gap-3">
        <Card><p className="text-2xl font-bold" style={{ color: "var(--text)" }}>{stats.total}</p><p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Tổng tin nhắn</p></Card>
        <Card><p className="text-2xl font-bold" style={{ color: "var(--amber)" }}>{stats.pending}</p><p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Chờ gửi</p></Card>
        <Card><p className="text-2xl font-bold" style={{ color: "var(--accent)" }}>{stats.sent}</p><p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Đã gửi</p></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Heart size={15} style={{ color: "var(--rose)" }} weight="fill" />
              <CardTitle>Tạo tin nhắn chăm sóc</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-3">
            <Select label="Loại tin nhắn" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="birthday">Chúc mừng sinh nhật</option>
              <option value="appointment">Nhắc lịch hẹn</option>
              <option value="followup">Hỏi thăm sau dịch vụ</option>
              <option value="promo">Thông báo khuyến mãi</option>
            </Select>
            {customers.length > 0 ? (
              <Select label="Chọn khách hàng" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
                <option value="">-- Chọn khách hàng --</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` (${c.phone})` : ""}</option>)}
              </Select>
            ) : (
              <div className="text-xs p-2 rounded" style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}>Chưa có khách hàng trong CRM. Thêm khách ở module Mini CRM.</div>
            )}
            {(form.type === "appointment" || form.type === "followup") && (
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Dịch vụ</label>
                <input className="w-full text-xs rounded-lg px-3 py-2 border" style={{ borderColor: "var(--border)", background: "var(--bg-card)", color: "var(--text)" }} placeholder="VD: Massage thư giãn" value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} />
              </div>
            )}
            <Button onClick={generate} loading={generating} className="w-full">
              <Sparkle size={13} weight="fill" /> Tạo tin nhắn AI
            </Button>
            {preview && (
              <div className="p-3 rounded-lg space-y-2" style={{ background: "var(--bg-subtle)" }}>
                <p className="text-xs" style={{ color: "var(--text)" }}>{preview.content}</p>
                <Button size="sm" onClick={() => markSent(preview.id)} className="w-full">
                  <CheckCircle size={12} weight="fill" /> Đánh dấu đã gửi
                </Button>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sinh nhật hôm nay</CardTitle>
            <Button size="sm" variant="secondary" loading={bulkLoading} onClick={bulkBirthday}>
              <Gift size={12} /> Tạo hàng loạt
            </Button>
          </CardHeader>
          <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>Tự động tạo tin nhắn sinh nhật cho các khách có sinh nhật hôm nay (DD/MM khớp).</p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {customers.filter((c: Customer & { birthday?: string | null }) => {
              const today = new Date();
              const md = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}`;
              return (c as any).birthday?.includes(md);
            }).map((c) => (
              <div key={c.id} className="text-xs py-1 flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
                <Gift size={11} style={{ color: "var(--amber)" }} weight="fill" />
                {c.name} — {c.phone || "Chưa có SĐT"}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Lịch sử tin nhắn</CardTitle></CardHeader>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {messages.length === 0 ? (
            <p className="text-xs text-center py-8" style={{ color: "var(--text-muted)" }}>Chưa có tin nhắn nào.</p>
          ) : (
            messages.map((m) => {
              const typeInfo = typeLabels[m.type] || typeLabels.promo;
              const Icon = typeInfo.icon;
              return (
                <div key={m.id} className="flex items-start gap-3 p-2.5 rounded-lg" style={{ background: "var(--bg-subtle)" }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: typeInfo.color + "18" }}>
                    <Icon size={13} style={{ color: typeInfo.color }} weight="fill" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium" style={{ color: "var(--text)" }}>{m.customer?.name || "Không có khách"}</span>
                      <Badge variant={m.status === "sent" ? "success" : "warning"}>{m.status === "sent" ? "Đã gửi" : "Chờ gửi"}</Badge>
                    </div>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{m.content}</p>
                  </div>
                  {m.status === "pending" && (
                    <Button size="sm" variant="secondary" onClick={() => markSent(m.id)}>Đã gửi</Button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}
