"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useActivePage } from "@/contexts/ActivePageContext";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { CheckCircle, Plus, Star, Trash, UploadSimple, UserCircle } from "@phosphor-icons/react";

interface StaffSample {
  id: string;
  imageUrl: string;
  angle: string | null;
  expression: string | null;
  outfit: string | null;
  notes: string | null;
  isPrimary: boolean;
}

interface StaffVisual {
  id: string;
  name: string;
  role: string | null;
  gender: string;
  referenceImageUrl: string | null;
  promptDescriptor: string;
  appearanceNotes: string | null;
  uniformNotes: string | null;
  usageNotes: string | null;
  consentStatus: string;
  isActive: boolean;
  samples: StaffSample[];
}

const blankForm = {
  name: "",
  role: "Kỹ thuật viên spa",
  gender: "female",
  referenceImageUrl: "",
  promptDescriptor: "",
  appearanceNotes: "",
  uniformNotes: "",
  usageNotes: "",
  consentStatus: "consented",
};

type StaffForm = typeof blankForm;

function formFromStaff(staff: StaffVisual): StaffForm {
  return {
    name: staff.name,
    role: staff.role ?? "",
    gender: staff.gender,
    referenceImageUrl: staff.referenceImageUrl ?? "",
    promptDescriptor: staff.promptDescriptor,
    appearanceNotes: staff.appearanceNotes ?? "",
    uniformNotes: staff.uniformNotes ?? "",
    usageNotes: staff.usageNotes ?? "",
    consentStatus: staff.consentStatus,
  };
}

async function uploadStaffFile(file: File) {
  const data = new FormData();
  data.append("file", file);
  const res = await fetch("/api/staff-visuals/upload", { method: "POST", body: data });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Upload ảnh thất bại");
  return json.data as { url: string };
}

export function StaffVisualLibrary() {
  const { selectedPageId } = useActivePage();
  const [staff, setStaff] = useState<StaffVisual[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<StaffForm>(blankForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sampleMeta, setSampleMeta] = useState({ angle: "portrait", expression: "", outfit: "", notes: "" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selected = useMemo(() => staff.find((item) => item.id === selectedId) ?? null, [staff, selectedId]);

  const load = useCallback(async () => {
    const url = selectedPageId ? `/api/staff-visuals?facebookPageId=${selectedPageId}&includeInactive=true` : "/api/staff-visuals?includeInactive=true";
    const res = await fetch(url);
    const json = await res.json();
    if (json.success) {
      setStaff(json.data ?? []);
      if (!selectedId && json.data?.[0]) {
        setSelectedId(json.data[0].id);
        setForm(formFromStaff(json.data[0]));
      }
    }
  }, [selectedId, selectedPageId]);

  useEffect(() => { load().catch(() => null); }, [load]);

  const selectStaff = (item: StaffVisual) => {
    setSelectedId(item.id);
    setForm(formFromStaff(item));
    setError("");
    setMessage("");
  };

  const newStaff = () => {
    setSelectedId(null);
    setForm(blankForm);
    setError("");
    setMessage("");
  };

  const saveStaff = async () => {
    if (!form.name.trim() || !form.promptDescriptor.trim()) {
      setError("Cần nhập tên và mô tả nhận diện cho prompt");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/staff-visuals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: selectedId ? "update" : "create",
          id: selectedId,
          facebookPageId: selectedPageId || null,
          ...form,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Không lưu được nhân viên");
        return;
      }
      setSelectedId(json.data.id);
      setForm(formFromStaff(json.data));
      setMessage("Đã lưu hồ sơ nhân viên mẫu.");
      await load();
    } finally {
      setSaving(false);
    }
  };

  const uploadPrimary = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const uploaded = await uploadStaffFile(file);
      setForm((prev) => ({ ...prev, referenceImageUrl: uploaded.url }));
      setMessage("Đã upload ảnh. Bấm Lưu để gắn vào hồ sơ.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  const uploadSample = async (file: File | null) => {
    if (!file || !selectedId) return;
    setUploading(true);
    setError("");
    try {
      const uploaded = await uploadStaffFile(file);
      const res = await fetch("/api/staff-visuals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add-sample",
          staffId: selectedId,
          imageUrl: uploaded.url,
          isPrimary: selected?.samples.length === 0,
          ...sampleMeta,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Không thêm được ảnh mẫu");
        return;
      }
      setMessage("Đã thêm ảnh mẫu.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  const postAction = async (body: Record<string, unknown>, success: string) => {
    const res = await fetch("/api/staff-visuals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Thao tác thất bại");
      return;
    }
    setMessage(success);
    await load();
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-4 max-w-6xl">
      <div className="space-y-3">
        <Card>
          <CardHeader>
            <CardTitle>Nhân viên</CardTitle>
            <Button size="sm" onClick={newStaff}><Plus size={12} /> Thêm</Button>
          </CardHeader>
          <div className="space-y-2">
            {staff.length === 0 ? (
              <p className="text-xs py-8 text-center" style={{ color: "var(--text-muted)" }}>Chưa có nhân viên mẫu</p>
            ) : staff.map((item) => (
              <button
                key={item.id}
                onClick={() => selectStaff(item)}
                className="w-full text-left rounded-lg p-2 flex gap-2 items-center transition-all"
                style={{
                  background: selectedId === item.id ? "var(--accent-light)" : "var(--bg-subtle)",
                  border: "1px solid var(--border)",
                  opacity: item.isActive ? 1 : 0.5,
                }}
              >
                {item.referenceImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.referenceImageUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "var(--bg-card)" }}>
                    <UserCircle size={20} style={{ color: "var(--text-muted)" }} />
                  </div>
                )}
                <span className="min-w-0">
                  <span className="block text-sm font-semibold truncate" style={{ color: "var(--text)" }}>{item.name}</span>
                  <span className="block text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
                    {item.role ?? "Nhân viên"} · {item.samples.length} ảnh · {item.consentStatus}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>{selected ? `Hồ sơ ${selected.name}` : "Thêm nhân viên mẫu"}</CardTitle>
            {selected && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => postAction({ action: "update", id: selected.id, isActive: !selected.isActive }, selected.isActive ? "Đã tắt nhân viên." : "Đã bật nhân viên.")}
              >
                {selected.isActive ? "Tắt" : "Bật"}
              </Button>
            )}
          </CardHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input label="Tên nhân viên" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input label="Vai trò" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Select label="Giới tính / mô tả" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="female">Nữ</option>
                <option value="male">Nam</option>
                <option value="neutral">Không chỉ định</option>
              </Select>
              <Select label="Quyền sử dụng" value={form.consentStatus} onChange={(e) => setForm({ ...form, consentStatus: e.target.value })}>
                <option value="consented">Đã đồng ý dùng marketing</option>
                <option value="limited">Chỉ dùng giới hạn</option>
                <option value="blocked">Không dùng để sinh ảnh</option>
              </Select>
            </div>
            <Textarea
              label="Mô tả nhận diện cho AI"
              rows={3}
              value={form.promptDescriptor}
              onChange={(e) => setForm({ ...form, promptDescriptor: e.target.value })}
              placeholder="VD: Nữ kỹ thuật viên Việt Nam, tóc đen buộc gọn, biểu cảm nhẹ nhàng, phong thái chuyên nghiệp..."
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input label="Ngoại hình / biểu cảm" value={form.appearanceNotes} onChange={(e) => setForm({ ...form, appearanceNotes: e.target.value })} />
              <Input label="Đồng phục" value={form.uniformNotes} onChange={(e) => setForm({ ...form, uniformNotes: e.target.value })} />
            </div>
            <Textarea
              label="Ghi chú sử dụng"
              rows={2}
              value={form.usageNotes}
              onChange={(e) => setForm({ ...form, usageNotes: e.target.value })}
              placeholder="VD: Chỉ dùng cho ảnh organic và story, không dùng cho ads ưu đãi mạnh."
            />
            <div className="rounded-lg p-3 space-y-2" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
              <label className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Ảnh chính</label>
              <div className="flex flex-col md:flex-row gap-3">
                {form.referenceImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.referenceImageUrl} alt="" className="w-24 h-24 rounded-lg object-cover" />
                )}
                <div className="flex-1 space-y-2">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => uploadPrimary(e.target.files?.[0] ?? null)}
                    className="block w-full text-xs"
                    style={{ color: "var(--text-secondary)" }}
                  />
                  <Input
                    value={form.referenceImageUrl}
                    onChange={(e) => setForm({ ...form, referenceImageUrl: e.target.value })}
                    placeholder="/uploads/staff-visuals/..."
                  />
                </div>
              </div>
            </div>
            {error && <p className="text-xs p-2 rounded" style={{ background: "var(--rose-light)", color: "var(--rose)" }}>{error}</p>}
            {message && <p className="text-xs p-2 rounded" style={{ background: "var(--success-light)", color: "var(--success)" }}>{message}</p>}
            <Button onClick={saveStaff} loading={saving || uploading} className="w-full">
              <CheckCircle size={14} weight="fill" /> Lưu hồ sơ
            </Button>
          </div>
        </Card>

        {selected && (
          <Card>
            <CardHeader>
              <CardTitle>Bộ ảnh mẫu</CardTitle>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>{selected.samples.length} ảnh</span>
            </CardHeader>
            <div className="rounded-lg p-3 mb-3" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                <Select label="Tag ảnh" value={sampleMeta.angle} onChange={(e) => setSampleMeta({ ...sampleMeta, angle: e.target.value })}>
                  <option value="portrait">Portrait</option>
                  <option value="working">Đang làm dịch vụ</option>
                  <option value="uniform">Đồng phục</option>
                  <option value="hands">Tay thao tác</option>
                  <option value="room">Không gian phòng</option>
                </Select>
                <Input label="Biểu cảm" value={sampleMeta.expression} onChange={(e) => setSampleMeta({ ...sampleMeta, expression: e.target.value })} />
                <Input label="Trang phục" value={sampleMeta.outfit} onChange={(e) => setSampleMeta({ ...sampleMeta, outfit: e.target.value })} />
                <label className="inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold cursor-pointer"
                  style={{ background: "var(--accent)", color: "white" }}>
                  <UploadSimple size={13} /> Upload
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => uploadSample(e.target.files?.[0] ?? null)}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {selected.samples.map((sample) => (
                <div key={sample.id} className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--bg-subtle)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={sample.imageUrl} alt="" className="w-full aspect-square object-cover" />
                  <div className="p-2 space-y-2">
                    <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
                      {sample.angle ?? "sample"}{sample.expression ? ` · ${sample.expression}` : ""}
                    </p>
                    <div className="grid grid-cols-2 gap-1">
                      <Button
                        size="sm"
                        variant={sample.isPrimary ? "primary" : "secondary"}
                        onClick={() => postAction({ action: "set-primary-sample", id: sample.id }, "Đã đặt ảnh chính.")}
                      >
                        <Star size={11} weight={sample.isPrimary ? "fill" : "regular"} /> Chính
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => postAction({ action: "delete-sample", id: sample.id }, "Đã xóa ảnh mẫu.")}
                      >
                        <Trash size={11} /> Xóa
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {selected.samples.length === 0 && (
                <p className="text-xs col-span-full text-center py-8" style={{ color: "var(--text-muted)" }}>
                  Chưa có ảnh mẫu. Upload ít nhất 1 ảnh chính diện hoặc ảnh đồng phục.
                </p>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
