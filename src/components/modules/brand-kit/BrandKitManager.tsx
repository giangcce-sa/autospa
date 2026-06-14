"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { CheckCircle } from "@phosphor-icons/react";
import { useActivePage } from "@/contexts/ActivePageContext";

interface BrandKit { logoUrl: string | null; primaryColor: string; accentColor: string; fontStyle: string; spaName: string | null; tagline: string | null; }

const PRESET_COLORS = ["#2d6a4f", "#1a5276", "#6c3483", "#cb4335", "#d68910", "#1e8449", "#2471a3"];
const EMPTY_FORM: BrandKit = { logoUrl: "", primaryColor: "#2d6a4f", accentColor: "#40c074", fontStyle: "elegant", spaName: "", tagline: "" };

export function BrandKitManager() {
  const { selectedPageId } = useActivePage();
  const [form, setForm] = useState<BrandKit>(EMPTY_FORM);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const url = selectedPageId ? `/api/brand-kit?facebookPageId=${selectedPageId}` : "/api/brand-kit";
    fetch(url).then((r) => r.json()).then((res) => {
      if (res.data) {
        setForm({ logoUrl: res.data.logoUrl ?? "", primaryColor: res.data.primaryColor, accentColor: res.data.accentColor, fontStyle: res.data.fontStyle, spaName: res.data.spaName ?? "", tagline: res.data.tagline ?? "" });
      } else {
        setForm(EMPTY_FORM);
      }
    });
  }, [selectedPageId]);

  const handleSave = async () => {
    setLoading(true);
    try {
      await fetch("/api/brand-kit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, facebookPageId: selectedPageId }) });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4 max-w-4xl">

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Thông tin cơ bản</CardTitle></CardHeader>
            <div className="space-y-3">
              <Input label="Tên spa" placeholder="VD: Spa ABC" value={form.spaName ?? ""} onChange={(e) => setForm({ ...form, spaName: e.target.value })} />
              <Input label="Tagline" placeholder="VD: Đẹp từ bên trong, tỏa sáng bên ngoài" value={form.tagline ?? ""} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
              <Input label="URL Logo" placeholder="https://..." value={form.logoUrl ?? ""} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} hint="URL ảnh logo của spa (PNG/JPG nền trong)" />
            </div>
          </Card>

          <Card>
            <CardHeader><CardTitle>Màu sắc thương hiệu</CardTitle></CardHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Màu chính</label>
                <div className="flex gap-2 flex-wrap mb-2">
                  {PRESET_COLORS.map((c) => (
                    <button key={c} onClick={() => setForm({ ...form, primaryColor: c })} className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110" style={{ background: c, borderColor: form.primaryColor === c ? "var(--text)" : "transparent" }} />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input type="color" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} className="w-10 h-10 rounded-lg border cursor-pointer" style={{ borderColor: "var(--border)" }} />
                  <Input value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} placeholder="#2d6a4f" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Màu phụ</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={form.accentColor} onChange={(e) => setForm({ ...form, accentColor: e.target.value })} className="w-10 h-10 rounded-lg border cursor-pointer" style={{ borderColor: "var(--border)" }} />
                  <Input value={form.accentColor} onChange={(e) => setForm({ ...form, accentColor: e.target.value })} placeholder="#40c074" />
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader><CardTitle>Phong cách chữ</CardTitle></CardHeader>
            <Select value={form.fontStyle} onChange={(e) => setForm({ ...form, fontStyle: e.target.value })}>
              <option value="elegant">Thanh lịch, tinh tế</option>
              <option value="modern">Hiện đại, trẻ trung</option>
              <option value="luxury">Sang trọng, cao cấp</option>
              <option value="friendly">Thân thiện, gần gũi</option>
            </Select>
          </Card>

          <Button onClick={handleSave} loading={loading} className="w-full">
            {saved ? <><CheckCircle size={14} weight="fill" /> Đã lưu!</> : "Lưu Brand Kit"}
          </Button>
        </div>

        <Card>
          <CardHeader><CardTitle>Xem trước</CardTitle></CardHeader>
          <div className="rounded-xl overflow-hidden border" style={{ borderColor: "var(--border)" }}>
            <div className="p-6 text-center" style={{ background: form.primaryColor }}>
              {form.logoUrl ? (
                <img src={form.logoUrl} alt="Logo" className="w-16 h-16 mx-auto rounded-full object-cover mb-3" onError={(e) => (e.currentTarget.style.display = "none")} />
              ) : (
                <div className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-2xl font-bold text-white" style={{ background: "rgba(255,255,255,0.2)" }}>
                  {(form.spaName || "S")[0]}
                </div>
              )}
              <p className="font-bold text-lg text-white">{form.spaName || "Tên Spa"}</p>
              {form.tagline && <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.8)" }}>{form.tagline}</p>}
            </div>
            <div className="p-4" style={{ background: "var(--bg-card)" }}>
              <div className="flex gap-2 mb-3">
                <div className="h-2 rounded-full flex-1" style={{ background: form.primaryColor }} />
                <div className="h-2 rounded-full w-12" style={{ background: form.accentColor }} />
              </div>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Màu chính: <span className="font-mono font-medium">{form.primaryColor}</span></p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Màu phụ: <span className="font-mono font-medium">{form.accentColor}</span></p>
              <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>Phong cách: {form.fontStyle}</p>
            </div>
          </div>
          <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>Brand Kit này sẽ được AI tham khảo khi tạo content và ảnh để đảm bảo nhất quán thương hiệu.</p>
        </Card>
      </div>
    </div>
  );
}
