"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { MediaAssetCard } from "@/components/media/MediaAssetCard";
import { MediaPreviewDialog } from "@/components/media/MediaPreviewDialog";
import { MediaStatusBadge } from "@/components/media/MediaStatusBadge";
import { Select } from "@/components/ui/Select";
import { useActivePage } from "@/contexts/ActivePageContext";
import { Textarea, Input } from "@/components/ui/Input";
import { formatDate, formatDateTime } from "@/lib/utils";
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

interface VisionScore {
  score: number;
  passed: boolean;
  summary: string;
  issues: { type: string; severity: "low" | "medium" | "high"; message: string }[];
  dimensions: Record<string, number>;
}

interface GeneratedVariant {
  imageUrl: string;
  generationId: string;
  vision: VisionScore | null;
  retryCount: number;
  status: string;
}

interface HistoryImage {
  id: string;
  postId: string | null;
  imageUrl: string;
  thumbnailUrl: string;
  model: string | null;
  preset: string;
  prompt: string;
  visualBrief: string | null;
  qualityScore: number;
  promptScore: number;
  visionScore: number | null;
  generationStatus: string;
  userAccepted: boolean | null;
  format: string;
  createdAt: string;
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
  referenceStorageKey: "",
  promptDescriptor: "",
  appearanceNotes: "",
  uniformNotes: "",
  usageNotes: "",
  consentStatus: "consented",
};

export function ImageGenerator({ postId, facebookPageId: providedPageId, onImageSet, onGoToPublish }: Props) {
  const { selectedPageId } = useActivePage();
  const facebookPageId = providedPageId ?? selectedPageId ?? undefined;
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
    referenceMode: "identity",
    referenceStrength: 0.8,
    variantCount: 2,
    autoQualityCheck: true,
    maxAutoRetries: 1,
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
    vision?: VisionScore | null;
    variants?: GeneratedVariant[];
    referenceApplied?: boolean;
  } | null>(null);
  const [activeVariant, setActiveVariant] = useState(0);
  const [loading, setLoading] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [history, setHistory] = useState<HistoryImage[]>([]);
  const [previewImage, setPreviewImage] = useState<HistoryImage | null>(null);

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
    setForm((previous) => ({ ...previous, serviceId: "", staffProfileId: "" }));
    setResult(null);
    setActiveVariant(0);
  }, [facebookPageId]);

  useEffect(() => {
    const url = facebookPageId ? `/api/images/visual-profile?facebookPageId=${facebookPageId}` : "/api/images/visual-profile";
    fetch(url).then((r) => r.json()).then((res) => setVisualProfile(res.data ?? null)).catch(() => null);
  }, [facebookPageId, result?.generationId]);

  useEffect(() => {
    const url = facebookPageId ? `/api/images/history?facebookPageId=${facebookPageId}&take=12` : "/api/images/history?take=12";
    fetch(url).then((res) => res.json()).then((data) => data.success && setHistory(data.data ?? [])).catch(() => null);
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
      setActiveVariant(0);
      setFeedbackMessage("");
      if (onImageSet) onImageSet(data.data.imageUrl);
    } finally { setLoading(false); }
  };

  const sendFeedback = async (rating: string) => {
    const selectedVariant = result?.variants?.[activeVariant];
    const generationId = selectedVariant?.generationId ?? result?.generationId;
    if (!generationId) return;
    setFeedbackLoading(rating);
    setFeedbackMessage("");
    try {
      const res = await fetch("/api/images/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generationId, rating }),
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
        if (staffForm.referenceStorageKey) {
          await fetch("/api/staff-visuals/upload", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ storageKey: staffForm.referenceStorageKey }),
          }).catch(() => null);
        }
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
      setStaffForm((prev) => ({ ...prev, referenceImageUrl: data.data.url, referenceStorageKey: data.data.storageKey }));
    } finally {
      setUploadingStaffImage(false);
    }
  };

  const handleDownload = async () => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.variants?.[activeVariant]?.imageUrl ?? result.imageUrl;
    a.download = `spa-image-${Date.now()}.png`;
    a.target = "_blank";
    a.click();
  };

  const handleSendToPublish = async () => {
    if (!result) return;
    const selected = result.variants?.[activeVariant];
    const selectedImageUrl = selected?.imageUrl ?? result.imageUrl;
    const generationId = selected?.generationId ?? result.generationId;
    setAttaching(true);
    setError("");
    try {
      if (postId && generationId) {
        const response = await fetch("/api/images/select", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId, generationId }),
        });
        const data = await response.json();
        if (!response.ok) {
          setError(data.error ?? "Không gắn được ảnh vào bài viết");
          return;
        }
      }
      if (onImageSet) onImageSet(selectedImageUrl);
      onGoToPublish?.();
    } finally {
      setAttaching(false);
    }
  };

  const applyImageEdit = async () => {
    const generationId = selectedVariant?.generationId ?? result?.generationId;
    if (!generationId || !result) return;
    setEditing(true);
    setError("");
    try {
      const res = await fetch("/api/images/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationId,
          facebookPageId,
          format: form.format,
          overlay: { ...overlay, enabled: overlay.enabled },
          applyToPost: Boolean(postId),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Không áp dụng được chỉnh sửa");
        return;
      }
      setResult((previous) => {
        if (!previous) return previous;
        const nextVariant: GeneratedVariant = {
          imageUrl: data.data.imageUrl,
          generationId: data.data.generationId,
          vision: selectedVariant?.vision ?? null,
          retryCount: selectedVariant?.retryCount ?? 0,
          status: "completed",
        };
        if (!previous.variants?.length) {
          return { ...previous, imageUrl: nextVariant.imageUrl, generationId: nextVariant.generationId, variants: [nextVariant] };
        }
        return {
          ...previous,
          imageUrl: activeVariant === 0 ? nextVariant.imageUrl : previous.imageUrl,
          generationId: activeVariant === 0 ? nextVariant.generationId : previous.generationId,
          variants: previous.variants.map((item, index) => index === activeVariant ? nextVariant : item),
        };
      });
      if (onImageSet) onImageSet(data.data.imageUrl);
      setFeedbackMessage("Đã lưu một phiên bản chỉnh sửa mới.");
    } finally {
      setEditing(false);
    }
  };

  const selectedVariant = result?.variants?.[activeVariant] ?? null;
  const displayImageUrl = selectedVariant?.imageUrl ?? result?.imageUrl ?? "";
  const displayVision = selectedVariant?.vision ?? result?.vision ?? null;

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
                  Dùng ảnh mẫu đã được nhân viên đồng ý để giữ hình ảnh nhân vật nhất quán hơn.
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
                setForm({
                  ...form,
                  staffProfileId: e.target.value,
                  character: e.target.value ? "staff-female" : form.character,
                  referenceDesc: form.referenceDesc,
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
              <div className="space-y-3">
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Select
                    label="Giữ ảnh tham chiếu"
                    value={form.referenceMode}
                    onChange={(e) => setForm({ ...form, referenceMode: e.target.value })}
                  >
                    <option value="identity">Giữ khuôn mặt và nhận diện</option>
                    <option value="appearance">Giữ ngoại hình, đổi bối cảnh</option>
                    <option value="style">Chỉ học đồng phục/phong cách</option>
                  </Select>
                  <label className="space-y-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                    <span className="flex justify-between"><span>Mức độ giữ mẫu</span><strong>{Math.round(form.referenceStrength * 100)}%</strong></span>
                    <input
                      type="range"
                      min="0.4"
                      max="1"
                      step="0.05"
                      value={form.referenceStrength}
                      onChange={(e) => setForm({ ...form, referenceStrength: Number(e.target.value) })}
                      className="w-full accent-[var(--accent)]"
                    />
                  </label>
                </div>
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
                    <option value="consented">Đã đồng ý dùng cho truyền thông</option>
                    <option value="limited">Chỉ sử dụng nội bộ hoặc có giới hạn</option>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Select label="Số phương án" value={String(form.variantCount)} onChange={(e) => setForm({ ...form, variantCount: Number(e.target.value) })}>
              <option value="1">1 ảnh</option>
              <option value="2">2 ảnh</option>
              <option value="3">3 ảnh</option>
              <option value="4">4 ảnh</option>
            </Select>
            <label className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs" style={{ background: "var(--bg-subtle)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
              <input
                type="checkbox"
                checked={form.autoQualityCheck}
                onChange={(e) => setForm({ ...form, autoQualityCheck: e.target.checked })}
                className="accent-[var(--accent)]"
              />
              AI Vision kiểm tra và tự sửa ảnh lỗi
            </label>
          </div>
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
            <img src={displayImageUrl} alt="Generated spa image" className="w-full rounded-t-xl object-cover aspect-square" />
            <div className="p-4 space-y-3">
              {result.variants && result.variants.length > 1 && (
                <div className="grid grid-cols-4 gap-2">
                  {result.variants.map((variant, index) => (
                    <button
                      key={variant.generationId}
                      type="button"
                      onClick={() => {
                        setActiveVariant(index);
                        if (onImageSet) onImageSet(variant.imageUrl);
                      }}
                      className="relative aspect-square overflow-hidden rounded-md"
                      style={{ border: activeVariant === index ? "2px solid var(--accent)" : "1px solid var(--border)" }}
                      title={`Phương án ${index + 1}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={variant.imageUrl} alt="" className="h-full w-full object-cover" />
                      <span className="absolute bottom-1 right-1 rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: "rgba(15,23,18,.78)", color: "white" }}>
                        {variant.vision?.score ?? "–"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {displayVision && (
                <div className="rounded-lg p-3" style={{ background: displayVision.score >= 80 ? "var(--success-light)" : displayVision.score >= 60 ? "var(--amber-light)" : "var(--rose-light)" }}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold inline-flex items-center gap-1.5" style={{ color: displayVision.score >= 80 ? "var(--success)" : displayVision.score >= 60 ? "var(--amber)" : "var(--rose)" }}>
                      {displayVision.score >= 80 ? <CheckCircle size={14} weight="fill" /> : <WarningCircle size={14} weight="fill" />}
                      Chất lượng ảnh {displayVision.score}/100
                    </span>
                    {selectedVariant?.retryCount ? <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Đã tự sửa {selectedVariant.retryCount} lần</span> : null}
                  </div>
                  <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>{displayVision.summary}</p>
                  {displayVision.issues.length > 0 && (
                    <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                      {displayVision.issues.slice(0, 2).map((issue) => issue.message).join(" · ")}
                    </p>
                  )}
                </div>
              )}
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
              <Button variant="secondary" onClick={applyImageEdit} loading={editing} className="w-full">
                <MagicWand size={13} weight="fill" /> Áp dụng crop và overlay thành phiên bản mới
              </Button>
              <Button onClick={handleSendToPublish} loading={attaching} className="w-full">
                <PaperPlaneTilt size={14} weight="fill" />
                {onGoToPublish ? "Gắn vào bài đăng →" : "Đã lưu vào bài"}
              </Button>
              {(selectedVariant?.generationId ?? result.generationId) && (
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
                  {form.staffProfileId && (
                    <div className="grid grid-cols-3 gap-2">
                      <Button size="sm" variant="ghost" onClick={() => sendFeedback("identity_match")} loading={feedbackLoading === "identity_match"}>
                        Đúng người
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => sendFeedback("identity_mismatch")} loading={feedbackLoading === "identity_mismatch"}>
                        Sai khuôn mặt
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => sendFeedback("bad_anatomy")} loading={feedbackLoading === "bad_anatomy"}>
                        Lỗi tay/mặt
                      </Button>
                    </div>
                  )}
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
              {history.length > 0 && (
                <div className="space-y-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>Thư viện gần đây</p>
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Chọn ảnh để dùng lại hoặc mở xem chi tiết.</p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {history.slice(0, 12).map((item) => {
                      const selected = item.id === (selectedVariant?.generationId ?? result.generationId);
                      return (
                        <MediaAssetCard
                          key={item.id}
                          title={item.visualBrief || item.prompt || "Ảnh đã tạo"}
                          description={item.prompt}
                          thumbnailUrl={item.thumbnailUrl}
                          aspectRatio={item.format}
                          selected={selected}
                          badges={<MediaStatusBadge status={item.userAccepted ? "approved" : item.generationStatus} />}
                          metadata={(
                            <>
                              <span>{item.format}</span>
                              <span>{item.model || "Model không rõ"}</span>
                              <span>{item.visionScore ?? item.qualityScore}/100</span>
                              <span>{formatDate(item.createdAt)}</span>
                              {item.postId && <span>Đang dùng trong bài</span>}
                            </>
                          )}
                          onSelect={() => {
                            const variant: GeneratedVariant = { imageUrl: item.imageUrl, generationId: item.id, vision: null, retryCount: 0, status: item.generationStatus };
                            setResult((previous) => previous
                              ? { ...previous, imageUrl: item.imageUrl, prompt: item.prompt, generationId: item.id, variants: [variant] }
                              : { imageUrl: item.imageUrl, prompt: item.prompt || "Ảnh trong lịch sử", generationId: item.id, variants: [variant] });
                            setActiveVariant(0);
                            setPreviewImage(item);
                            if (onImageSet) onImageSet(item.imageUrl);
                          }}
                        />
                      );
                    })}
                  </div>
                  <MediaPreviewDialog
                    open={Boolean(previewImage)}
                    onOpenChange={(open) => { if (!open) setPreviewImage(null); }}
                    title={previewImage?.visualBrief || "Ảnh đã tạo"}
                    description={previewImage?.prompt}
                    mediaUrl={previewImage?.imageUrl}
                    aspectRatio={previewImage?.format}
                    details={previewImage ? (
                      <div className="space-y-3 text-sm">
                        <div className="flex flex-wrap gap-2"><MediaStatusBadge status={previewImage.userAccepted ? "approved" : previewImage.generationStatus} /></div>
                        <dl className="space-y-2 text-xs">
                          <div className="flex justify-between gap-3"><dt className="text-[var(--text-muted)]">Định dạng</dt><dd>{previewImage.format}</dd></div>
                          <div className="flex justify-between gap-3"><dt className="text-[var(--text-muted)]">Model</dt><dd>{previewImage.model || "Không rõ"}</dd></div>
                          <div className="flex justify-between gap-3"><dt className="text-[var(--text-muted)]">Chất lượng</dt><dd>{previewImage.visionScore ?? previewImage.qualityScore}/100</dd></div>
                          <div className="flex justify-between gap-3"><dt className="text-[var(--text-muted)]">Ngày tạo</dt><dd>{formatDateTime(previewImage.createdAt)}</dd></div>
                        </dl>
                      </div>
                    ) : null}
                  />
                </div>
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
