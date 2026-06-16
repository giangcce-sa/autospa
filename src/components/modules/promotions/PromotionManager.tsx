"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Textarea, Input } from "@/components/ui/Input";
import { StatusBadge } from "@/components/ui/Badge";
import { useActivePage } from "@/contexts/ActivePageContext";
import { Sparkle, Tag, Copy, CheckCircle, PaperPlaneTilt, CalendarBlank } from "@phosphor-icons/react";
import { formatDateTime, truncate } from "@/lib/utils";

interface Service { id: string; name: string; }
interface Post { id: string; caption: string; status: string; createdAt: string; service: { name: string } | null; }

export function PromotionManager() {
  const { selectedPageId } = useActivePage();
  const [services, setServices] = useState<Service[]>([]);
  const [history, setHistory] = useState<Post[]>([]);
  const [form, setForm] = useState({
    dealName: "",
    discount: "20",
    validUntil: "",
    serviceId: "",
    description: "",
    platform: "facebook",
  });
  const [result, setResult] = useState<{ caption: string; hashtags: string } | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const q = selectedPageId ? `?facebookPageId=${selectedPageId}` : "";
    fetch(`/api/services${q}`).then((r) => r.json()).then((d) => setServices(d.data ?? []));
    fetch(`/api/promotions${q}`).then((r) => r.json()).then((d) => setHistory(d.data ?? []));
  }, [selectedPageId]);

  const handleGenerate = async () => {
    if (!form.dealName || !form.discount) { setError("Điền tên chương trình và % giảm giá"); return; }
    setGenerating(true);
    setError("");
    setPublished(false);
    try {
      const res = await fetch("/api/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", facebookPageId: selectedPageId || null, ...form }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setResult(data.data);
    } finally { setGenerating(false); }
  };

  const handlePublish = async (schedule = false) => {
    if (!result) return;
    if (schedule && !scheduledAt) { setError("Chọn thời gian lên lịch"); return; }
    setPublishing(true);
    setError("");
    try {
      const res = await fetch("/api/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "publish",
          facebookPageId: selectedPageId || null,
          caption: result.caption,
          hashtags: result.hashtags,
          imageUrl: imageUrl || undefined,
          platform: form.platform,
          scheduledAt: schedule ? scheduledAt : undefined,
          serviceId: form.serviceId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setPublished(true);
      setResult(null);
      setForm({ dealName: "", discount: "20", validUntil: "", serviceId: "", description: "", platform: "facebook" });
      // Refresh history
      const q = selectedPageId ? `?facebookPageId=${selectedPageId}` : "";
      fetch(`/api/promotions${q}`).then((r) => r.json()).then((d) => setHistory(d.data ?? []));
    } finally { setPublishing(false); }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(`${result.caption}\n\n${result.hashtags}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Tạo Flash Deal</CardTitle>
            <Tag size={15} style={{ color: "var(--accent)" }} weight="fill" />
          </CardHeader>
          <div className="space-y-3">
            <Input
              label="Tên chương trình"
              placeholder="VD: Ưu đãi mùa hè, Giảm giá sinh nhật..."
              value={form.dealName}
              onChange={(e) => setForm({ ...form, dealName: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Giảm giá (%)"
                type="number"
                min={1}
                max={100}
                placeholder="20"
                value={form.discount}
                onChange={(e) => setForm({ ...form, discount: e.target.value })}
              />
              <Input
                label="Hết hạn"
                type="date"
                value={form.validUntil}
                onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
              />
            </div>
            <Select
              label="Dịch vụ áp dụng"
              value={form.serviceId}
              onChange={(e) => setForm({ ...form, serviceId: e.target.value })}
            >
              <option value="">Tất cả dịch vụ</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Select
              label="Đăng lên"
              value={form.platform}
              onChange={(e) => setForm({ ...form, platform: e.target.value })}
            >
              <option value="facebook">Facebook</option>
              <option value="zalo">Zalo OA</option>
            </Select>
            <Textarea
              label="Chi tiết thêm (tùy chọn)"
              placeholder="VD: Giảm 30% khi đặt online trước 12h trưa..."
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            {error && <p className="text-xs p-2 rounded" style={{ background: "var(--rose-light)", color: "var(--rose)" }}>{error}</p>}
            {published && (
              <div className="flex items-center gap-2 text-xs p-2 rounded" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
                <CheckCircle size={13} weight="fill" /> Đã đăng/lên lịch thành công!
              </div>
            )}
            <Button onClick={handleGenerate} loading={generating} className="w-full">
              <Sparkle size={14} weight="fill" /> Tạo caption AI
            </Button>
          </div>
        </Card>

        {/* Result */}
        <Card>
          <CardHeader>
            <CardTitle>Caption & Đăng bài</CardTitle>
            {result && (
              <Button size="sm" variant="secondary" onClick={handleCopy}>
                {copied ? <CheckCircle size={12} weight="fill" /> : <Copy size={12} />}
                {copied ? "Đã copy" : "Copy"}
              </Button>
            )}
          </CardHeader>
          {result ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Caption</label>
                <div className="p-3 rounded-lg text-sm leading-relaxed whitespace-pre-wrap" style={{ background: "var(--bg-subtle)", color: "var(--text)" }}>
                  {result.caption}
                </div>
              </div>
              {result.hashtags && (
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Hashtags</label>
                  <p className="text-xs" style={{ color: "var(--accent)" }}>{result.hashtags}</p>
                </div>
              )}
              <Input
                label="URL hình ảnh (tùy chọn)"
                placeholder="https://..."
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
              />
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Lên lịch (tùy chọn)</label>
                <input
                  type="datetime-local"
                  className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
                  style={{ background: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text)" }}
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                />
              </div>
              <div className="flex gap-2">
                {scheduledAt && (
                  <Button variant="secondary" onClick={() => handlePublish(true)} loading={publishing} className="flex-1">
                    <CalendarBlank size={13} /> Lên lịch
                  </Button>
                )}
                <Button onClick={() => handlePublish(false)} loading={publishing} className="flex-1">
                  <PaperPlaneTilt size={13} weight="fill" /> Đăng ngay
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Tag size={32} className="mb-2 opacity-20" style={{ color: "var(--text-secondary)" }} />
              <p className="text-sm font-medium" style={{ color: "var(--text)" }}>Caption sẽ hiện ở đây</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Điền thông tin deal và nhấn Tạo caption AI</p>
            </div>
          )}
        </Card>
      </div>

      {/* History */}
      {history.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Lịch sử khuyến mãi</CardTitle></CardHeader>
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {history.map((p) => (
              <div key={p.id} className="flex items-start gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm" style={{ color: "var(--text)" }}>{truncate(p.caption, 80)}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {p.service?.name && <span className="mr-2">{p.service.name}</span>}
                    {formatDateTime(p.createdAt)}
                  </p>
                </div>
                <StatusBadge status={p.status} />
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
