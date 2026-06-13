"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Input";
import { Sparkle, ArrowCounterClockwise, DownloadSimple, Image as ImageIcon, PaperPlaneTilt } from "@phosphor-icons/react";

interface Service { id: string; name: string; }

const styles = [
  { value: "bright", label: "Tươi sáng, hiện đại" },
  { value: "luxury", label: "Sang trọng, cao cấp" },
  { value: "natural", label: "Tự nhiên, organic" },
];

export function ImageGenerator() {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [form, setForm] = useState({ serviceId: "", style: "bright", customPrompt: "" });
  const [result, setResult] = useState<{ imageUrl: string; prompt: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/services").then((r) => r.json()).then((res) => res.data && setServices(res.data.filter((s: Service & { active: boolean }) => s.active)));
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/openai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setResult(data.data);
    } finally { setLoading(false); }
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
    router.push(`/publish?imageUrl=${encodeURIComponent(result.imageUrl)}`);
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
          <Select label="Phong cách" value={form.style} onChange={(e) => setForm({ ...form, style: e.target.value })}>
            {styles.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
          <Textarea
            label="Mô tả thêm (tùy chọn)"
            placeholder="VD: Hình ảnh thiên về tông màu xanh lá, có hoa sen..."
            rows={3}
            value={form.customPrompt}
            onChange={(e) => setForm({ ...form, customPrompt: e.target.value })}
          />
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
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                <span className="font-medium" style={{ color: "var(--text-secondary)" }}>Prompt: </span>
                {result.prompt.length > 100 ? result.prompt.slice(0, 100) + "..." : result.prompt}
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={handleGenerate} loading={loading} className="flex-1">
                  <ArrowCounterClockwise size={13} /> Tạo lại
                </Button>
                <Button variant="secondary" onClick={handleDownload} className="flex-1">
                  <DownloadSimple size={13} /> Tải về
                </Button>
              </div>
              {/* CTA: send to publish */}
              <Button onClick={handleSendToPublish} className="w-full">
                <PaperPlaneTilt size={14} weight="fill" /> Gắn vào bài đăng
              </Button>
              <p className="text-[10px] text-center" style={{ color: "var(--text-muted)" }}>
                Mở trang Đăng bài với hình này đã điền sẵn
              </p>
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
