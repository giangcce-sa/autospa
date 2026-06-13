"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { UserCircle, Plus, Star, Users, Crown, ArrowLeft, PencilSimple, Trash, Note } from "@phosphor-icons/react";

interface Customer { id: string; name: string; phone?: string | null; fbName?: string | null; email?: string | null; birthday?: string | null; segment: string; leadScore: number; lastContact?: string | null; note?: string | null; tags?: string | null; createdAt: string; }
interface CustomerDetail extends Customer { notes: { id: string; content: string; type: string; createdAt: string }[]; appointments: { id: string; service?: string | null; preferredAt?: string | null; status: string }[]; }
interface Stats { total: number; new: number; regular: number; vip: number; }

const SegmentBadge = ({ s }: { s: string }) => {
  if (s === "vip") return <Badge variant="warning"><Crown size={9} className="mr-0.5" /> VIP</Badge>;
  if (s === "regular") return <Badge variant="success">Thân thiết</Badge>;
  return <Badge variant="neutral">Mới</Badge>;
};

const emptyForm = { name: "", phone: "", email: "", birthday: "", fbName: "", segment: "new", leadScore: 0, note: "", tags: "" };

export function CRMManager() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, new: 0, regular: 0, vip: 0 });
  const [selected, setSelected] = useState<CustomerDetail | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState("");
  const [filterSegment, setFilterSegment] = useState("");

  const load = (seg?: string) =>
    fetch(`/api/crm${seg ? `?segment=${seg}` : ""}`).then((r) => r.json()).then((res) => {
      if (res.data) { setCustomers(res.data.customers); setStats(res.data.stats); }
    });

  useEffect(() => { load(); }, []);

  const loadDetail = (id: string) =>
    fetch(`/api/crm?id=${id}`).then((r) => r.json()).then((res) => res.data && setSelected(res.data));

  const handleSave = async () => {
    if (!form.name.trim()) return;
    await fetch("/api/crm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editId ? { ...form, id: editId, leadScore: Number(form.leadScore) } : { ...form, leadScore: Number(form.leadScore) }),
    });
    setForm(emptyForm); setShowForm(false); setEditId(null); load();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/crm?id=${id}`, { method: "DELETE" });
    if (selected?.id === id) setSelected(null);
    load();
  };

  const addNote = async () => {
    if (!selected || !noteContent.trim()) return;
    await fetch("/api/crm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "add-note", customerId: selected.id, content: noteContent }) });
    setNoteContent(""); loadDetail(selected.id);
  };

  const startEdit = (c: Customer) => {
    setForm({ name: c.name, phone: c.phone ?? "", email: c.email ?? "", birthday: c.birthday ?? "", fbName: c.fbName ?? "", segment: c.segment, leadScore: c.leadScore, note: c.note ?? "", tags: c.tags ?? "" });
    setEditId(c.id); setShowForm(true);
  };

  if (selected) {
    return (
      <div className="space-y-4 max-w-3xl">
        <Button size="sm" variant="secondary" onClick={() => setSelected(null)}><ArrowLeft size={13} /> Quay lại</Button>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white" style={{ background: "var(--accent)" }}>{selected.name[0]}</div>
                  <div>
                    <p className="font-semibold" style={{ color: "var(--text)" }}>{selected.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5"><SegmentBadge s={selected.segment} /><span className="text-xs" style={{ color: "var(--text-muted)" }}>Lead score: {selected.leadScore}</span></div>
                  </div>
                </div>
                <Button size="sm" variant="secondary" onClick={() => { startEdit(selected); setSelected(null); }}><PencilSimple size={12} /></Button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-y-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                {selected.phone && <span>📞 {selected.phone}</span>}
                {selected.email && <span>✉️ {selected.email}</span>}
                {selected.birthday && <span>🎂 {selected.birthday}</span>}
                {selected.fbName && <span>👤 {selected.fbName}</span>}
              </div>
              {selected.tags && <div className="mt-2 flex flex-wrap gap-1">{selected.tags.split(",").map((t) => <span key={t} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>{t.trim()}</span>)}</div>}
            </Card>

            <Card>
              <CardHeader><CardTitle>Ghi chú</CardTitle></CardHeader>
              <div className="space-y-2 mb-3">
                <Textarea rows={2} placeholder="Thêm ghi chú..." value={noteContent} onChange={(e) => setNoteContent(e.target.value)} />
                <Button size="sm" onClick={addNote}><Note size={12} /> Lưu ghi chú</Button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {selected.notes.map((n) => (
                  <div key={n.id} className="p-2 rounded-lg text-xs" style={{ background: "var(--bg-subtle)", color: "var(--text-secondary)" }}>
                    <p>{n.content}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{new Date(n.createdAt).toLocaleDateString("vi-VN")}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="space-y-3">
            <Card>
              <CardTitle className="mb-2">Lịch hẹn gần đây</CardTitle>
              {selected.appointments.length === 0 ? <p className="text-xs" style={{ color: "var(--text-muted)" }}>Chưa có</p> : selected.appointments.map((a) => (
                <div key={a.id} className="py-1.5 border-b text-xs" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                  <p>{a.service || "Chưa xác định"}</p>
                  <p style={{ color: "var(--text-muted)" }}>{a.preferredAt || "Chưa có giờ"} · {a.status}</p>
                </div>
              ))}
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[{ label: "Tất cả", value: stats.total, icon: Users, color: "var(--text-secondary)" }, { label: "Khách mới", value: stats.new, icon: UserCircle, color: "var(--blue)" }, { label: "Thân thiết", value: stats.regular, icon: Star, color: "var(--accent)" }, { label: "VIP", value: stats.vip, icon: Crown, color: "var(--amber)" }].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <div className="flex items-center gap-2 mb-1"><Icon size={14} style={{ color }} weight="fill" /></div>
            <p className="text-2xl font-bold" style={{ color: "var(--text)" }}>{value}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2">
          {["", "new", "regular", "vip"].map((s) => (
            <Button key={s} size="sm" variant={filterSegment === s ? "primary" : "secondary"} onClick={() => { setFilterSegment(s); load(s || undefined); }}>
              {s === "" ? "Tất cả" : s === "new" ? "Mới" : s === "regular" ? "Thân thiết" : "VIP"}
            </Button>
          ))}
        </div>
        <Button size="sm" onClick={() => { setForm(emptyForm); setEditId(null); setShowForm(!showForm); }}>
          <Plus size={12} /> Thêm khách
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle>{editId ? "Sửa thông tin" : "Thêm khách hàng mới"}</CardTitle></CardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Tên *" placeholder="Nguyễn Văn A" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="Điện thoại" placeholder="0909xxxxxx" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input label="Email" placeholder="abc@gmail.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input label="Sinh nhật" placeholder="DD/MM" value={form.birthday} onChange={(e) => setForm({ ...form, birthday: e.target.value })} />
            <Input label="Facebook Name" value={form.fbName} onChange={(e) => setForm({ ...form, fbName: e.target.value })} />
            <Input label="Tags (phân cách bởi dấu phẩy)" placeholder="da nhạy cảm, thường xuyên" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
            <Select label="Phân khúc" value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })}>
              <option value="new">Khách mới</option>
              <option value="regular">Khách thân thiết</option>
              <option value="vip">VIP</option>
            </Select>
            <Input label="Lead Score (0-100)" type="number" value={String(form.leadScore)} onChange={(e) => setForm({ ...form, leadScore: Number(e.target.value) })} />
          </div>
          <Textarea label="Ghi chú" rows={2} className="mt-3" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <div className="flex gap-2 mt-3">
            <Button onClick={handleSave}>{editId ? "Cập nhật" : "Thêm"}</Button>
            <Button variant="secondary" onClick={() => { setShowForm(false); setEditId(null); }}>Huỷ</Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {customers.map((c) => (
          <Card key={c.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => loadDetail(c.id).then(() => {})}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-white shrink-0" style={{ background: c.segment === "vip" ? "var(--amber)" : c.segment === "regular" ? "var(--accent)" : "var(--text-muted)" }}>{c.name[0]}</div>
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{c.name}</p>
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{c.phone || "Chưa có SĐT"}</p>
                </div>
              </div>
              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                <Button size="sm" variant="secondary" onClick={() => startEdit(c)}><PencilSimple size={11} /></Button>
                <Button size="sm" variant="danger" onClick={() => handleDelete(c.id)}><Trash size={11} /></Button>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <SegmentBadge s={c.segment} />
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Score: {c.leadScore}</span>
            </div>
            {c.tags && <p className="text-[10px] mt-1 truncate" style={{ color: "var(--text-muted)" }}>{c.tags}</p>}
          </Card>
        ))}
        {customers.length === 0 && (
          <div className="col-span-3 py-12 text-center text-xs" style={{ color: "var(--text-muted)" }}>Chưa có khách hàng. Nhấn "Thêm khách" để bắt đầu.</div>
        )}
      </div>
    </div>
  );
}
