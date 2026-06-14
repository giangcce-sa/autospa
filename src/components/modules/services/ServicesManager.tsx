"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Plus, PencilSimple, Trash, Briefcase, X } from "@phosphor-icons/react";
import { useActivePage } from "@/contexts/ActivePageContext";

interface Service {
  id: string;
  name: string;
  description: string | null;
  price: string | null;
  category: string | null;
  duration: string | null;
  active: boolean;
}

const categories = ["Chăm sóc da", "Triệt lông", "Giảm béo", "Trị mụn", "Nail", "Massage", "Khác"];
const emptyForm = { name: "", description: "", price: "", category: "", duration: "" };

export function ServicesManager() {
  const { selectedPageId } = useActivePage();
  const [services, setServices] = useState<Service[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);

  const load = (pageId?: string) =>
    fetch(pageId ? `/api/services?facebookPageId=${pageId}` : "/api/services").then((r) => r.json()).then((res) => res.data && setServices(res.data));

  useEffect(() => {
    load(selectedPageId || undefined);
  }, [selectedPageId]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (s: Service) => {
    setEditing(s);
    setForm({ name: s.name, description: s.description ?? "", price: s.price ?? "", category: s.category ?? "", duration: s.duration ?? "" });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      const url = editing ? `/api/services/${editing.id}` : "/api/services";
      const method = editing ? "PUT" : "POST";
      await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, facebookPageId: selectedPageId }),
      });
      setShowForm(false);
      load(selectedPageId || undefined);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Xóa dịch vụ này?")) return;
    await fetch(`/api/services/${id}`, { method: "DELETE" });
    load(selectedPageId || undefined);
  };

  const toggleActive = async (s: Service) => {
    await fetch(`/api/services/${s.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...s, active: !s.active }) });
    load(selectedPageId || undefined);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div />
        <Button onClick={openCreate}>
          <Plus size={14} weight="bold" /> Thêm dịch vụ
        </Button>
      </div>

      {showForm && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm" style={{ color: "var(--text)" }}>
              {editing ? "Chỉnh sửa dịch vụ" : "Thêm dịch vụ mới"}
            </h3>
            <button onClick={() => setShowForm(false)} style={{ color: "var(--text-muted)" }}>
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Tên dịch vụ *" placeholder="VD: Triệt lông vĩnh viễn" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Select label="Danh mục" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="">Chọn danh mục</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Input label="Giá" placeholder="VD: 500.000đ" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            <Input label="Thời gian" placeholder="VD: 60 phút" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
            <div className="sm:col-span-2">
              <Textarea label="Mô tả" placeholder="Mô tả ngắn về dịch vụ..." rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2 mt-4 justify-end">
            <Button variant="secondary" onClick={() => setShowForm(false)}>Hủy</Button>
            <Button onClick={handleSave} loading={loading}>Lưu dịch vụ</Button>
          </div>
        </Card>
      )}

      {services.length === 0 ? (
        <EmptyState icon={<Briefcase size={40} />} title="Chưa có dịch vụ nào" description="Thêm dịch vụ đầu tiên để bắt đầu tạo nội dung" action={<Button onClick={openCreate}><Plus size={14} /> Thêm ngay</Button>} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {services.map((s) => (
            <Card key={s.id} className="group">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate" style={{ color: "var(--text)" }}>{s.name}</p>
                  {s.category && <span className="text-xs" style={{ color: "var(--text-muted)" }}>{s.category}</span>}
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--text-secondary)" }}>
                    <PencilSimple size={13} />
                  </button>
                  <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--rose)" }}>
                    <Trash size={13} />
                  </button>
                </div>
              </div>
              {s.description && <p className="text-xs mb-3 line-clamp-2" style={{ color: "var(--text-secondary)" }}>{s.description}</p>}
              <div className="flex items-center justify-between">
                <div className="flex gap-2 flex-wrap">
                  {s.price && <Badge variant="neutral">{s.price}</Badge>}
                  {s.duration && <Badge variant="neutral">{s.duration}</Badge>}
                </div>
                <button onClick={() => toggleActive(s)} className="text-xs font-medium">
                  <Badge variant={s.active ? "success" : "neutral"}>{s.active ? "Hoạt động" : "Ẩn"}</Badge>
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
