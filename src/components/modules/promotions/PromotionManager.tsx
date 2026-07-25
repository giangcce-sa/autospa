"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Textarea, Input } from "@/components/ui/Input";
import { StatusBadge } from "@/components/ui/Badge";
import { useActivePage } from "@/contexts/ActivePageContext";
import { Sparkle, Tag, Copy, CheckCircle, PaperPlaneTilt } from "@phosphor-icons/react";
import { formatDateTime, truncate } from "@/lib/utils";

interface Service { id: string; name: string; }
interface Post { id: string; caption: string; status: string; createdAt: string; service: { name: string } | null; }

export function PromotionManager({
  facebookPageId,
  initialServices,
  initialHistory,
  canMutate = true,
}: {
  facebookPageId?: string;
  initialServices?: Service[];
  initialHistory?: Post[];
  canMutate?: boolean;
} = {}) {
  const router = useRouter();
  const { selectedPageId } = useActivePage();
  const resolvedPageId = facebookPageId ?? selectedPageId ?? undefined;
  const [services, setServices] = useState<Service[]>(initialServices ?? []);
  const [history, setHistory] = useState<Post[]>(initialHistory ?? []);
  const [form, setForm] = useState({
    dealName: "",
    discount: "20",
    validUntil: "",
    serviceId: "",
    description: "",
  });
  const [result, setResult] = useState<{ caption: string; hashtags: string } | null>(null);
  const [postId, setPostId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialServices && initialHistory) {
      setServices(initialServices);
      setHistory(initialHistory);
      return;
    }
    if (!resolvedPageId) return;
    const q = `?facebookPageId=${encodeURIComponent(resolvedPageId)}`;
    fetch(`/api/services${q}`).then((r) => r.json()).then((d) => setServices(d.data ?? []));
    fetch(`/api/promotions${q}`).then((r) => r.json()).then((d) => setHistory(d.data ?? []));
  }, [initialHistory, initialServices, resolvedPageId]);

  const handleGenerate = async () => {
    if (!form.dealName || !form.discount) { setError("Điền tên chương trình và % giảm giá"); return; }
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", facebookPageId: resolvedPageId, ...form }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setResult(data.data);
      setPostId(data.data.postId);
      if (initialHistory) router.refresh();
    } finally { setGenerating(false); }
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
            <CardTitle>Tạo khuyến mãi</CardTitle>
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
            <Textarea
              label="Chi tiết thêm (tùy chọn)"
              placeholder="VD: Giảm 30% khi đặt online trước 12h trưa..."
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            {error && <p className="text-xs p-2 rounded" style={{ background: "var(--rose-light)", color: "var(--rose)" }}>{error}</p>}
            {canMutate ? (
              <Button onClick={handleGenerate} loading={generating} disabled={!resolvedPageId} className="w-full">
                <Sparkle size={14} weight="fill" /> Tạo và lưu draft
              </Button>
            ) : (
              <p className="rounded-lg bg-[var(--bg-subtle)] p-3 text-xs text-[var(--text-secondary)]">Chỉ owner mới có thể tạo draft khuyến mãi.</p>
            )}
          </div>
        </Card>

        {/* Result */}
        <Card>
          <CardHeader>
            <CardTitle>Draft khuyến mãi</CardTitle>
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
              {postId && resolvedPageId ? (
                <Button
                  onClick={() => router.push(`/creative/publishing?view=composer&scope=current&pageId=${encodeURIComponent(resolvedPageId)}&id=${encodeURIComponent(postId)}`)}
                  className="w-full"
                >
                  <PaperPlaneTilt size={13} weight="fill" /> Review và phân phối
                </Button>
              ) : null}
              <p className="text-xs leading-5 text-[var(--text-muted)]">Draft đã được lưu. Hình ảnh, review, lịch và kết quả từng kênh được quản lý tại Publishing.</p>
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
