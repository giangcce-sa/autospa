"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Textarea, Input } from "@/components/ui/Input";
import {
  Sparkle, ArrowCounterClockwise, DownloadSimple, Image as ImageIcon, PaperPlaneTilt,
  CheckCircle, WarningCircle, MagicWand, ThumbsUp, ThumbsDown, UserCircle, Plus, X,
} from "@phosphor-icons/react";

interface Service { id: string; name: string; }

interface Props {
  postId?: string;
  facebookPageId?: string;
  onImageSet?: (imageUrl: string) => void;
  onGoToPublish?: () => void;
}

const styles = [
  { value: "bright", label: "Tươi sáng, hiện đại" },
  { value: "luxury", label: "Sang trọng, cao cấp" },
  { value: "natural", label: "Tự nhiên, organic" },
  { value: "clinical", label: "Sạch, chuyên gia da liễu" },
  { value: "editorial", label: "Editorial beauty" },
];

const presets = [
  { value: "organic", label: "Organic post" },
  { value: "ads", label: "Ads creative" },
  { value: "story", label: "Story/Reels" },
  { value: "flash_deal", label: "Flash deal" },
  { value: "testimonial", label: "Testimonial" },
  { value: "educational", label: "Educational skincare" },
  { value: "service_hero", label: "Service hero" },
  { value: "before_after_concept", label: "Before/after concept" },
];

const characters = [
  { value: "", label: "Không có người" },
  { value: "female-vn", label: "Phụ nữ Việt Nam (khách hàng)" },
  { value: "male-vn", label: "Nam Việt Nam (khách hàng)" },
  { value: "staff-female", label: "Nhân viên nữ chuyên nghiệp" },
  { value: "hands", label: "Chỉ bàn tay (đang thực hiện)" },
];

const equipment = [
  { value: "", label: "Không có thiết bị cụ thể" },
  { value: "laser", label: "Máy laser / triệt lông" },
  { value: "spa-bed", label: "Giường spa / ghế điều trị" },
  { value: "facial-machine", label: "Máy chăm sóc da mặt" },
  { value: "nail-tools", label: "Dụng cụ nail / manicure" },
  { value: "massage-tools", label: "Đá nóng / dụng cụ massage" },
  { value: "skincare-products", label: "Mỹ phẩm / sản phẩm chăm sóc" },
];

interface QualityScore {
  score: number;
  issues: { type: string; message: string }[];
  dimensions: Record<string, number>;
}

interface VisualProfile {
  id: string;
  approvedImages: number;
  rejectedImages: number;
  confidence: number;
  autoApply: boolean;
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
  consentStatus: string;
  samples: { id: string; imageUrl: string; isPrimary: boolean }[];
}

const blankStaffForm = {
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

export function ImageGenerator({ postId, facebookPageId, onImageSet, onGoToPublish }: Props) {
  const [services, setServices] = useState<Service[]>([]);
  const [visualProfile, setVisualProfile] = useState<VisualProfile | null>(null);
  const [staffVisuals, setStaffVisuals] = useState<StaffVisual[]>([]);
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [staffForm, setStaffForm] = useState(blankStaffForm);
  const [savingStaff, setSavingStaff] = useState(false);
  const [uploadingStaffImage, setUploadingStaffImage] = useState(false);
  const [form, setForm] = useState({
    serviceId: "",
    style: "bright",
    preset: "organic",
    customPrompt: "",
    caption: "",
    character: "",
    equipment: "",
    referenceDesc: "",
    format: "feed",
    staffProfileId: "",
  });
  const [overlay, setOverlay] = useState({
    enabled: false,
    caption: "",
    subheadline: "",
    cta: "",
    badge: "",
    showLogo: true,
    position: "top-right" as "top-right" | "top-left" | "bottom-right" | "bottom-left",
    template: "minimal" as "none" | "minimal" | "promo" | "story" | "badge",
  });
  const [result, setResult] = useState<{
    imageUrl: string;
    prompt: string;
    generationId?: string;
    quality?: QualityScore;
    suggestedOverlay?: { headline: string; subheadline: string; cta: string; badge: string };
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");

  useEffect(() => {
    const url = facebookPageId ? `/api/services?facebookPageId=${facebookPageId}` : "/api/services";
    fetch(url).then((r) => r.json()).then((res) => res.data && setServices(res.data.filter((s: Service & { active: boolean }) => s.active)));
  }, [facebookPageId]);

  const loadStaffVisuals = useCallback(async () => {
    const url = facebookPageId ? `/api/staff-visuals?facebookPageId=${facebookPageId}` : "/api/staff-visuals";
    const res = await fetch(url);
    const data = await res.json();
    if (data.success) setStaffVisuals(data.data ?? []);
  }, [facebookPageId]);

  useEffect(() => { loadStaffVisuals().catch(() => null); }, [loadStaffVisuals]);

  useEffect(() => {
    const url = facebookPageId ? `/api/images/visual-profile?facebookPageId=${facebookPageId}` : "/api/images/visual-profile";
    fetch(url).then((r) => r.json()).then((res) => setVisualProfile(res.data ?? null)).catch(() => null);
  }, [facebookPageId, result?.generationId]);

  useEffect(() => {
    setOverlay((prev) => ({
      ...prev,
      template: form.preset === "flash_deal" ? "promo" : form.preset === "story" ? "story" : prev.template,
    }));
  }, [form.preset]);

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/openai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          facebookPageId,
          postId,
          overlayCaption: overlay.enabled ? overlay.caption.trim() || undefined : undefined,
          overlaySubheadline: overlay.enabled ? overlay.subheadline.trim() || undefined : undefined,
          overlayCta: overlay.enabled ? overlay.cta.trim() || undefined : undefined,
          overlayBadge: overlay.enabled ? overlay.badge.trim() || undefined : undefined,
          overlayTemplate: overlay.enabled ? overlay.template : "none",
          overlayLogo: overlay.enabled ? overlay.showLogo : false,
          overlayPosition: overlay.position,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setResult(data.data);
      setFeedbackMessage("");
      if (onImageSet) onImageSet(data.data.imageUrl);
    } finally { setLoading(false); }
  };

  const sendFeedback = async (rating: string) => {
    if (!result?.generationId) return;
    setFeedbackLoading(rating);
    setFeedbackMessage("");
    try {
      const res = await fetch("/api/images/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generationId: result.generationId, rating }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedbackMessage(data.error ?? "Không lưu được feedback");
        return;
      }
      setFeedbackMessage(data.data?.visualProfile ? "Đã học lại gu hình ảnh từ feedback." : "Đã lưu feedback ảnh.");
      if (data.data?.visualProfile) setVisualProfile(data.data.visualProfile);
    } finally {
      setFeedbackLoading(null);
    }
  };

  const saveStaffVisual = async () => {
    if (!staffForm.name.trim() || !staffForm.promptDescriptor.trim()) {
      setError("Cần nhập tên và mô tả nhận diện nhân viên");
      return;
    }
    setSavingStaff(true);
    setError("");
    try {
      const res = await fetch("/api/staff-visuals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          facebookPageId,
          ...staffForm,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Không lưu được nhân viên mẫu");
        return;
      }
      setStaffForm(blankStaffForm);
      setShowStaffForm(false);
      await loadStaffVisuals();
      setForm((prev) => ({ ...prev, staffProfileId: data.data.id, character: "staff-female" }));
    } finally {
      setSavingStaff(false);
    }
  };

  const uploadStaffImage = async (file: File | null) => {
    if (!file) return;
    setUploadingStaffImage(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/staff-visuals/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Không upload được ảnh nhân viên");
        return;
      }
      setStaffForm((prev) => ({ ...prev, referenceImageUrl: data.data.url }));
    } finally {
      setUploadingStaffImage(false);
    }
  };

  const handleDownload = async () => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.imageUrl;
    a.download = `spa-image-${Date.now()}.png`;
    a.target = "_blank";
    a.click();
  };

  const handleSendToPublish = () => {
    if (!result) return;
    if (onGoToPublish) {
      onGoToPublish();
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-5xl">
      <Card>
        <CardHeader><CardTitle>Tùy chọn hình ảnh</CardTitle></CardHeader>
        <div className="space-y-3">
          <Select label="Dịch vụ" value={form.serviceId} onChange={(e) => setForm({ ...form, serviceId: e.target.value })}>
            <option value="">Không chọn dịch vụ cụ thể</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Select label="Mục tiêu ảnh" value={form.preset} onChange={(e) => setForm({ ...form, preset: e.target.value })}>
              {presets.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </Select>
            <Select label="Phong cách" value={form.style} onChange={(e) => setForm({ ...form, style: e.target.value })}>
              {styles.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Select label="Nhân vật mẫu" value={form.character} onChange={(e) => setForm({ ...form, character: e.target.value })}>
              {characters.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
            <Select label="Thiết bị / dụng cụ" value={form.equipment} onChange={(e) => setForm({ ...form, equipment: e.target.value })}>
              {equipment.map((eq) => <option key={eq.value} value={eq.value}>{eq.label}</option>)}
            </Select>
          </div>
          <div className="rounded-xl p-3 space-y-3" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold inline-flex items-center gap-1.5" style={{ color: "var(--text)" }}>
                  <UserCircle size={14} weight="fill" /> Thư viện nhân viên mẫu
                </p>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  Dùng ảnh mẫu đã có consent để AI giữ nhân vật nhất quán hơn.
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setShowStaffForm((v) => !v)}>
                {showStaffForm ? <X size={12} /> : <Plus size={12} />} {showStaffForm ? "Đóng" : "Thêm"}
              </Button>
            </div>
            <Select
              label="Chọn nhân viên"
              value={form.staffProfileId}
              onChange={(e) => {
                const selected = staffVisuals.find((s) => s.id === e.target.value);
                setForm({
                  ...form,
                  staffProfileId: e.target.value,
                  character: e.target.value ? "staff-female" : form.character,
                  referenceDesc: selected?.referenceImageUrl
                    ? `Ảnh mẫu nhân viên đã duyệt: ${selected.referenceImageUrl}`
                    : form.referenceDesc,
                });
              }}
            >
              <option value="">Không dùng nhân viên cụ thể</option>
              {staffVisuals
                .filter((staff) => staff.consentStatus !== "blocked")
                .map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.name}{staff.role ? ` - ${staff.role}` : ""}{staff.consentStatus === "limited" ? " (giới hạn)" : ""}
                  </option>
                ))}
            </Select>
            {form.staffProfileId && (
              <div className="flex gap-2 items-start">
                {staffVisuals.find((s) => s.id === form.staffProfileId)?.referenceImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={staffVisuals.find((s) => s.id === form.staffProfileId)?.referenceImageUrl ?? ""}
                    alt=""
                    className="w-14 h-14 rounded-lg object-cover"
                  />
                )}
                <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {staffVisuals.find((s) => s.id === form.staffProfileId)?.promptDescriptor}
                </p>
              </div>
            )}
            {showStaffForm && (
              <div className="space-y-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Input
                    label="Tên nhân viên"
                    value={staffForm.name}
                    onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                    placeholder="VD: Linh"
                  />
                  <Input
                    label="Vai trò"
                    value={staffForm.role}
                    onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}
                    placeholder="VD: Kỹ thuật viên chăm sóc da"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                    Upload ảnh mẫu
                  </label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => uploadStaffImage(e.target.files?.[0] ?? null)}
                      className="block w-full text-xs"
                      style={{ color: "var(--text-secondary)" }}
                    />
                    {uploadingStaffImage && (
                      <span className="text-[11px] shrink-0" style={{ color: "var(--text-muted)" }}>Đang upload...</span>
                    )}
                  </div>
                  {staffForm.referenceImageUrl && (
                    <div className="flex items-center gap-2 rounded-lg p-2" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={staffForm.referenceImageUrl} alt="" className="w-14 h-14 rounded-lg object-cover" />
                      <Input
                        label="URL ảnh mẫu"
                        value={staffForm.referenceImageUrl}
                        onChange={(e) => setStaffForm({ ...staffForm, referenceImageUrl: e.target.value })}
                        placeholder="/uploads/staff-visuals/..."
                      />
                    </div>
                  )}
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                    Hỗ trợ JPG, PNG, WebP tối đa 8MB. Nên dùng ảnh nhân viên đã đồng ý dùng cho marketing.
                  </p>
                </div>
                <Textarea
                  label="Mô tả nhận diện cho AI"
                  rows={2}
                  value={staffForm.promptDescriptor}
                  onChange={(e) => setStaffForm({ ...staffForm, promptDescriptor: e.target.value })}
                  placeholder="VD: Nữ kỹ thuật viên Việt Nam khoảng 25-30 tuổi, tóc đen buộc gọn, nụ cười nhẹ, phong thái chuyên nghiệp..."
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Input
                    label="Ngoại hình / biểu cảm"
                    value={staffForm.appearanceNotes}
                    onChange={(e) => setStaffForm({ ...staffForm, appearanceNotes: e.target.value })}
                    placeholder="VD: Trang điểm nhẹ, da tự nhiên, biểu cảm thân thiện"
                  />
                  <Input
                    label="Đồng phục"
                    value={staffForm.uniformNotes}
                    onChange={(e) => setStaffForm({ ...staffForm, uniformNotes: e.target.value })}
                    placeholder="VD: Đồng phục spa màu xanh sage, tóc buộc gọn"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-end">
                  <Select
                    label="Quyền sử dụng"
                    value={staffForm.consentStatus}
                    onChange={(e) => setStaffForm({ ...staffForm, consentStatus: e.target.value })}
                  >
                    <option value="consented">Đã đồng ý dùng marketing</option>
                    <option value="limited">Chỉ dùng nội bộ / giới hạn</option>
                    <option value="blocked">Không dùng để sinh ảnh</option>
                  </Select>
                  <Button onClick={saveStaffVisual} loading={savingStaff}>
                    Lưu nhân viên mẫu
                  </Button>
                </div>
              </div>
            )}
          </div>
          <Select label="Định dạng" value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })}>
            <option value="feed">FB Feed - vuông 1:1 (1024x1024)</option>
            <option value="cover">FB Cover - ngang 16:9 (1792x1024)</option>
            <option value="story">Story/Reels - dọc 9:16 (1024x1792)</option>
            <option value="thumbnail">Video Thumbnail - ngang 16:9</option>
            <option value="zalo">Zalo OA - vuông + safe area</option>
          </Select>
          <Textarea
            label="Caption / ngữ cảnh bài viết"
            placeholder={postId ? "Để trống = lấy caption từ bài nháp" : "Dán caption để AI tạo ảnh đúng nội dung bài..."}
            rows={2}
            value={form.caption}
            onChange={(e) => setForm({ ...form, caption: e.target.value })}
          />
          <Input
            label="Phong cách ảnh mẫu (tùy chọn)"
            placeholder="VD: Phong cách Hàn Quốc, nền trắng tối giản, ánh sáng dịu..."
            value={form.referenceDesc}
            onChange={(e) => setForm({ ...form, referenceDesc: e.target.value })}
            hint="Mô tả ảnh mẫu bạn muốn AI học theo"
          />
          <Textarea
            label="Visual brief"
            placeholder="VD: Một góc phòng treatment thật, ánh sáng dịu, có máy facial và khăn sạch..."
            rows={2}
            value={form.customPrompt}
            onChange={(e) => setForm({ ...form, customPrompt: e.target.value })}
          />
          {visualProfile && (
            <div className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: "var(--accent-light)" }}>
              <span className="text-xs inline-flex items-center gap-1.5" style={{ color: "var(--accent)" }}>
                <MagicWand size={13} weight="fill" />
                Visual memory: {visualProfile.approvedImages} đúng style · {Math.round(visualProfile.confidence * 100)}%
              </span>
              <span className="text-[11px]" style={{ color: "var(--accent)" }}>{visualProfile.autoApply ? "Đang áp dụng" : "Tắt"}</span>
            </div>
          )}
          {/* Brand overlay */}
          <div className="rounded-xl p-3 space-y-2" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={overlay.enabled}
                onChange={(e) => setOverlay({ ...overlay, enabled: e.target.checked })}
                className="w-3.5 h-3.5 accent-[var(--accent)]"
              />
              <span className="text-xs font-medium" style={{ color: "var(--text)" }}>
                Overlay logo + caption thương hiệu
              </span>
            </label>
            {overlay.enabled && (
              <>
                <Select
                  label="Template overlay"
                  value={overlay.template}
                  onChange={(e) => setOverlay({ ...overlay, template: e.target.value as typeof overlay.template })}
                >
                  <option value="minimal">Minimal headline</option>
                  <option value="promo">Promo / flash deal</option>
                  <option value="story">Story safe area</option>
                  <option value="badge">Badge nhẹ</option>
                  <option value="none">Không overlay text</option>
                </Select>
                <Input
                  label="Headline trên ảnh"
                  placeholder="Để trống = AI đề xuất theo dịch vụ/bài viết"
                  value={overlay.caption}
                  onChange={(e) => setOverlay({ ...overlay, caption: e.target.value })}
                />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <Input
                    label="Subheadline"
                    placeholder="VD: Êm, sạch, riêng tư"
                    value={overlay.subheadline}
                    onChange={(e) => setOverlay({ ...overlay, subheadline: e.target.value })}
                  />
                  <Input
                    label="Badge"
                    placeholder="VD: Ưu đãi"
                    value={overlay.badge}
                    onChange={(e) => setOverlay({ ...overlay, badge: e.target.value })}
                  />
                  <Input
                    label="CTA"
                    placeholder="VD: Đặt lịch"
                    value={overlay.cta}
                    onChange={(e) => setOverlay({ ...overlay, cta: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 items-end">
                  <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "var(--text-secondary)" }}>
                    <input
                      type="checkbox"
                      checked={overlay.showLogo}
                      onChange={(e) => setOverlay({ ...overlay, showLogo: e.target.checked })}
                      className="w-3.5 h-3.5 accent-[var(--accent)]"
                    />
                    Hiện logo (từ Brand Kit)
                  </label>
                  <Select
                    label="Vị trí logo"
                    value={overlay.position}
                    onChange={(e) => setOverlay({ ...overlay, position: e.target.value as typeof overlay.position })}
                  >
                    <option value="top-right">Góc trên phải</option>
                    <option value="top-left">Góc trên trái</option>
                    <option value="bottom-right">Góc dưới phải</option>
                    <option value="bottom-left">Góc dưới trái</option>
                  </Select>
                </div>
              </>
            )}
          </div>

          {error && <p className="text-xs p-2 rounded" style={{ background: "var(--rose-light)", color: "var(--rose)" }}>{error}</p>}
          <Button onClick={handleGenerate} loading={loading} className="w-full">
            <Sparkle size={14} weight="fill" /> Tạo hình ảnh
          </Button>
        </div>
      </Card>

      <Card padding="none">
          {result ? (
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={result.imageUrl} alt="Generated spa image" className="w-full rounded-t-xl object-cover aspect-square" />
            <div className="p-4 space-y-3">
              {result.quality && (
                <div className="rounded-lg p-3" style={{ background: result.quality.score >= 80 ? "var(--success-light)" : "var(--amber-light)" }}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold inline-flex items-center gap-1.5" style={{ color: result.quality.score >= 80 ? "var(--success)" : "var(--amber)" }}>
                      {result.quality.score >= 80 ? <CheckCircle size={14} weight="fill" /> : <WarningCircle size={14} weight="fill" />}
                      Image Prompt Score {result.quality.score}/100
                    </span>
                    <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{result.quality.issues.length} lưu ý</span>
                  </div>
                  {result.quality.issues.length > 0 && (
                    <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                      {result.quality.issues.slice(0, 2).map((i) => i.message).join(" · ")}
                    </p>
                  )}
                </div>
              )}
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                <span className="font-medium" style={{ color: "var(--text-secondary)" }}>Prompt: </span>
                {result.prompt.length > 120 ? result.prompt.slice(0, 120) + "..." : result.prompt}
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={handleGenerate} loading={loading} className="flex-1">
                  <ArrowCounterClockwise size={13} /> Tạo lại
                </Button>
                <Button variant="secondary" onClick={handleDownload} className="flex-1">
                  <DownloadSimple size={13} /> Tải về
                </Button>
              </div>
              <Button onClick={handleSendToPublish} className="w-full">
                <PaperPlaneTilt size={14} weight="fill" />
                {onGoToPublish ? "Gắn vào bài đăng →" : "Đã lưu vào bài"}
              </Button>
              {result.generationId && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" variant="secondary" onClick={() => sendFeedback("right_style")} loading={feedbackLoading === "right_style"}>
                      <ThumbsUp size={13} weight="fill" /> Đúng style
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => sendFeedback("too_ai")} loading={feedbackLoading === "too_ai"}>
                      <ThumbsDown size={13} /> Quá AI
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Button size="sm" variant="ghost" onClick={() => sendFeedback("wrong_service")} loading={feedbackLoading === "wrong_service"}>
                      Sai dịch vụ
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => sendFeedback("off_brand")} loading={feedbackLoading === "off_brand"}>
                      Lệch brand
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => sendFeedback("bad_layout")} loading={feedbackLoading === "bad_layout"}>
                      Bố cục xấu
                    </Button>
                  </div>
                  {feedbackMessage && (
                    <p className="text-[11px] text-center" style={{ color: "var(--text-muted)" }}>{feedbackMessage}</p>
                  )}
                </div>
              )}
              {postId && (
                <p className="text-[10px] text-center" style={{ color: "var(--text-muted)" }}>
                  Hình đã được lưu vào bài nháp
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center p-6">
            <ImageIcon size={40} className="mb-2 opacity-20" style={{ color: "var(--text-secondary)" }} />
            <p className="text-sm font-medium" style={{ color: "var(--text)" }}>Hình ảnh sẽ hiện ở đây</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Chọn tùy chọn và nhấn Tạo hình ảnh</p>
          </div>
        )}
      </Card>
    </div>
  );
}
