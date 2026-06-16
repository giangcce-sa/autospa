"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Sparkle, Copy, CheckCircle, PaperPlaneTilt, Image as ImageIcon, ArrowsSplit, BookOpen } from "@phosphor-icons/react";

interface Service { id: string; name: string; category: string | null; }
interface Story { id: string; type: string; customerName: string | null; content: string; service: string | null; }

interface Props {
  facebookPageId?: string;
  onSaved?: (postId: string, caption: string, hashtags: string) => void;
  onGoToImage?: () => void;
  onGoToPublish?: (postId?: string) => void;
}

const postTypes = [
  { value: "service", label: "Giới thiệu dịch vụ" },
  { value: "promotion", label: "Khuyến mãi" },
  { value: "tip", label: "Tip làm đẹp" },
  { value: "intro", label: "Giới thiệu combo" },
];

const tones = [
  { value: "friendly", label: "Thân thiện" },
  { value: "professional", label: "Chuyên nghiệp" },
  { value: "luxury", label: "Sang trọng" },
];

export function ContentGenerator({ facebookPageId, onSaved, onGoToImage, onGoToPublish }: Props) {
  const [services, setServices] = useState<Service[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [styleSampleCount, setStyleSampleCount] = useState(0);
  const [includeStory, setIncludeStory] = useState(false);
  const [selectedStoryId, setSelectedStoryId] = useState("");
  const [form, setForm] = useState({ serviceId: "", postType: "service", tone: "friendly", customNote: "", platform: "facebook" });
  const [result, setResult] = useState<{ caption: string; hashtags: string; postId?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [repurposed, setRepurposed] = useState<Record<string, string> | null>(null);
  const [repurposing, setRepurposing] = useState(false);
  const [abGroup, setAbGroup] = useState<{ abGroupId: string; captionA: string; captionB: string } | null>(null);
  const [creatingAb, setCreatingAb] = useState(false);

  useEffect(() => {
    const url = facebookPageId ? `/api/services?facebookPageId=${facebookPageId}` : "/api/services";
    fetch(url).then((r) => r.json()).then((res) => res.data && setServices(res.data.filter((s: Service & { active: boolean }) => s.active)));

    const styleUrl = facebookPageId ? `/api/style-training?facebookPageId=${facebookPageId}` : "/api/style-training";
    fetch(styleUrl).then((r) => r.json()).then((res) => {
      if (res.data) setStyleSampleCount(res.data.samples?.length ?? 0);
    });

    const storyUrl = facebookPageId ? `/api/stories?facebookPageId=${facebookPageId}` : "/api/stories";
    fetch(storyUrl).then((r) => r.json()).then((res) => {
      if (res.data) setStories(res.data);
    });
  }, [facebookPageId]);

  const handleGenerate = async (saveToLibrary = false) => {
    setLoading(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, saveToLibrary, facebookPageId, includeStory, storyId: selectedStoryId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setResult(data.data);
      if (saveToLibrary) {
        setSaved(true);
        if (data.data.postId && onSaved) onSaved(data.data.postId, data.data.caption, data.data.hashtags);
      }
      return data.data as { caption: string; hashtags: string; postId?: string };
    } finally { setLoading(false); }
  };

  const handleSaveAndSend = async (target: "image" | "publish") => {
    setSaving(true);
    setError("");
    try {
      let postId = result?.postId;
      if (!postId) {
        const res = await fetch("/api/content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, saveToLibrary: true, facebookPageId, includeStory, storyId: selectedStoryId || undefined }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error); return; }
        setResult(data.data);
        setSaved(true);
        postId = data.data.postId;
        if (postId && onSaved) onSaved(postId, data.data.caption, data.data.hashtags);
      }
      if (target === "image" && onGoToImage) onGoToImage();
      if (target === "publish" && onGoToPublish) onGoToPublish(postId);
    } finally { setSaving(false); }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(`${result.caption}\n\n${result.hashtags}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateAb = async () => {
    if (!result) return;
    setCreatingAb(true);
    setAbGroup(null);
    try {
      const res = await fetch("/api/ab-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          caption: result.caption,
          platform: form.platform,
          tone: form.tone,
          serviceId: form.serviceId || undefined,
          facebookPageId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAbGroup({ abGroupId: data.data.abGroupId, captionA: data.data.postA.caption, captionB: data.data.postB.caption });
      }
    } finally { setCreatingAb(false); }
  };

  const handleRepurpose = async () => {
    if (!result) return;
    setRepurposing(true);
    setRepurposed(null);
    try {
      const res = await fetch("/api/repurpose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption: result.caption, hashtags: result.hashtags, platform: form.platform, facebookPageId }),
      });
      const data = await res.json();
      if (data.success) setRepurposed(data.data);
    } finally { setRepurposing(false); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-5xl">
      <Card>
        <CardHeader><CardTitle>Tùy chọn nội dung</CardTitle></CardHeader>
        <div className="space-y-3">
          {styleSampleCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
              <Sparkle size={12} weight="fill" />
              Dùng {styleSampleCount} bài mẫu Style Training để tạo content
            </div>
          )}
          <Select label="Dịch vụ" value={form.serviceId} onChange={(e) => setForm({ ...form, serviceId: e.target.value })}>
            <option value="">Không chọn dịch vụ cụ thể</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name}{s.category ? ` (${s.category})` : ""}</option>)}
          </Select>
          <Select label="Loại bài" value={form.postType} onChange={(e) => setForm({ ...form, postType: e.target.value })}>
            {postTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
          <Select label="Giọng văn" value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })}>
            {tones.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
          <Select label="Nền tảng" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
            <option value="facebook">Facebook</option>
            <option value="zalo">Zalo OA</option>
            <option value="tiktok">TikTok</option>
          </Select>
          <Textarea
            label="Ghi chú thêm (tùy chọn)"
            placeholder="VD: Nhấn mạnh ưu đãi giảm 30% tháng này..."
            rows={3}
            value={form.customNote}
            onChange={(e) => setForm({ ...form, customNote: e.target.value })}
          />
          {/* Story toggle */}
          <div className="rounded-xl p-3 space-y-2" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={includeStory}
                onChange={(e) => setIncludeStory(e.target.checked)}
                className="w-3.5 h-3.5 accent-[var(--accent)]"
              />
              <BookOpen size={13} style={{ color: "var(--accent)" }} weight="fill" />
              <span className="text-xs font-medium" style={{ color: "var(--text)" }}>
                Kết hợp câu chuyện thực tế
              </span>
              {stories.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full ml-auto" style={{ background: "var(--accent)", color: "white" }}>
                  {stories.length} câu chuyện
                </span>
              )}
            </label>

            {includeStory && (
              <div>
                {stories.length === 0 ? (
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    Chưa có câu chuyện nào — vào{" "}
                    <a href="/stories" className="underline" style={{ color: "var(--accent)" }}>Câu chuyện thực tế</a>{" "}
                    để thêm phản hồi khách hàng, kết quả điều trị...
                  </p>
                ) : (
                  <select
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border outline-none"
                    style={{ background: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text)" }}
                    value={selectedStoryId}
                    onChange={(e) => setSelectedStoryId(e.target.value)}
                  >
                    <option value="">AI tự chọn câu chuyện phù hợp nhất</option>
                    {stories.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.customerName ? `${s.customerName} — ` : ""}{s.content.slice(0, 50)}...
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>

          {error && <p className="text-xs p-2 rounded" style={{ background: "var(--rose-light)", color: "var(--rose)" }}>{error}</p>}
          <Button onClick={() => handleGenerate(true)} loading={loading} className="w-full">
            <Sparkle size={14} weight="fill" /> Tạo nội dung
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kết quả</CardTitle>
          {result && (
            <div className="flex gap-1.5">
              <Button size="sm" variant="secondary" onClick={handleCopy}>
                {copied ? <CheckCircle size={13} weight="fill" /> : <Copy size={13} />}
                {copied ? "Đã copy" : "Copy"}
              </Button>
              {saved && <Badge variant="success">Đã lưu</Badge>}
            </div>
          )}
        </CardHeader>
        {result ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Caption</label>
              <div className="p-3 rounded-lg text-sm leading-relaxed whitespace-pre-wrap" style={{ background: "var(--bg-subtle)", color: "var(--text)" }}>
                {result.caption}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Hashtags</label>
              <div className="flex flex-wrap gap-1.5">
                {result.hashtags.split("\n").filter(Boolean).map((h, i) => (
                  <Badge key={i} variant="info">{h.trim()}</Badge>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t space-y-2" style={{ borderColor: "var(--border)" }}>
              {onGoToImage && (
                <Button onClick={() => handleSaveAndSend("image")} loading={saving} variant="secondary" className="w-full">
                  <ImageIcon size={14} /> Tạo hình ảnh cho bài này
                </Button>
              )}
              {onGoToPublish && (
                <Button onClick={() => handleSaveAndSend("publish")} loading={saving} className="w-full" variant="primary">
                  <PaperPlaneTilt size={14} weight="fill" /> Gửi sang Đăng bài
                </Button>
              )}
              {!onGoToImage && !onGoToPublish && (
                <Button onClick={() => handleSaveAndSend("publish")} loading={saving} className="w-full" variant="primary">
                  <PaperPlaneTilt size={14} weight="fill" /> Gửi sang Đăng bài
                </Button>
              )}
              <div className="flex gap-2">
                <Button onClick={handleRepurpose} loading={repurposing} variant="secondary" className="flex-1">
                  <ArrowsSplit size={14} /> Đa kênh
                </Button>
                <Button onClick={handleCreateAb} loading={creatingAb} variant="secondary" className="flex-1">
                  A/B Test
                </Button>
              </div>
            </div>

            {abGroup && (
              <div className="pt-2 border-t space-y-3" style={{ borderColor: "var(--border)" }}>
                <p className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>A/B Test — Hai phiên bản đã lưu nháp</p>
                {[{ label: "A (Gốc)", text: abGroup.captionA }, { label: "B (Biến thể AI)", text: abGroup.captionB }].map(({ label, text }) => (
                  <div key={label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold" style={{ color: "var(--accent)" }}>Phiên bản {label}</span>
                      <button onClick={() => navigator.clipboard.writeText(text)} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}>Copy</button>
                    </div>
                    <p className="text-xs leading-relaxed p-2 rounded whitespace-pre-wrap" style={{ background: "var(--bg-subtle)", color: "var(--text)" }}>{text}</p>
                  </div>
                ))}
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Đăng cả 2 bài, sau 48h so sánh engagement trong Thư viện → A/B</p>
              </div>
            )}

            {repurposed && (
              <div className="pt-2 border-t space-y-2" style={{ borderColor: "var(--border)" }}>
                <p className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>Phiên bản đa kênh</p>
                {Object.entries(repurposed).map(([channel, text]) => (
                  <div key={channel}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--accent)" }}>{channel}</span>
                      <button
                        onClick={() => { navigator.clipboard.writeText(text); }}
                        className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}
                      >
                        Copy
                      </button>
                    </div>
                    <p className="text-xs leading-relaxed p-2 rounded whitespace-pre-wrap" style={{ background: "var(--bg-subtle)", color: "var(--text)" }}>
                      {text}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Sparkle size={32} className="mb-2 opacity-20" style={{ color: "var(--text-secondary)" }} />
            <p className="text-sm font-medium" style={{ color: "var(--text)" }}>Kết quả sẽ hiện ở đây</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Chọn tùy chọn và nhấn Tạo nội dung</p>
          </div>
        )}
      </Card>
    </div>
  );
}
