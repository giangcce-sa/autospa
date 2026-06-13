"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Plus, Trash, Buildings } from "@phosphor-icons/react";

interface BrandItem { id: string; category: string; title: string; content: string; }

const categories = [
  "Giới thiệu spa",
  "Giá trị cốt lõi",
  "Điểm khác biệt",
  "Chính sách",
  "FAQ",
  "Giọng văn thương hiệu",
];

const emptyForm = { category: "", title: "", content: "" };

export function BrandManager() {
  const [items, setItems] = useState<BrandItem[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);

  const load = () => fetch("/api/brand").then((r) => r.json()).then((res) => res.data && setItems(res.data));
  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!form.category || !form.title || !form.content) return;
    setLoading(true);
    try {
      await fetch("/api/brand", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      setForm(emptyForm);
      load();
    } finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Xóa mục này?")) return;
    await fetch(`/api/brand/${id}`, { method: "DELETE" });
    load();
  };

  const grouped = categories.reduce((acc, cat) => {
    acc[cat] = items.filter((i) => i.category === cat);
    return acc;
  }, {} as Record<string, BrandItem[]>);

  return (
    <div className="space-y-4 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>Thêm thông tin mới</CardTitle>
        </CardHeader>
        <div className="space-y-3">
          <Select label="Danh mục" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            <option value="">Chọn danh mục</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Input label="Tiêu đề" placeholder="VD: Slogan của spa" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Textarea label="Nội dung" placeholder="Nhập thông tin chi tiết..." rows={4} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          <div className="flex justify-end">
            <Button onClick={handleAdd} loading={loading}><Plus size={14} /> Thêm</Button>
          </div>
        </div>
      </Card>

      {categories.map((cat) => {
        const catItems = grouped[cat] ?? [];
        if (catItems.length === 0) return null;
        return (
          <Card key={cat}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Buildings size={14} style={{ color: "var(--accent)" }} />
                <CardTitle>{cat}</CardTitle>
              </div>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>{catItems.length} mục</span>
            </CardHeader>
            <div className="space-y-2">
              {catItems.map((item) => (
                <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: "var(--bg-subtle)" }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium mb-1" style={{ color: "var(--text)" }}>{item.title}</p>
                    <p className="text-xs line-clamp-2" style={{ color: "var(--text-secondary)" }}>{item.content}</p>
                  </div>
                  <button onClick={() => handleDelete(item.id)} className="shrink-0 p-1" style={{ color: "var(--rose)" }}>
                    <Trash size={13} />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        );
      })}

      {items.length === 0 && (
        <div className="text-center py-12" style={{ color: "var(--text-muted)" }}>
          <Buildings size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">Chưa có thông tin thương hiệu nào</p>
        </div>
      )}
    </div>
  );
}
