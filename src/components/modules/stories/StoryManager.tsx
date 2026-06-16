"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea, Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useActivePage } from "@/contexts/ActivePageContext";
import {
  Plus, Pencil, Trash, CheckCircle, Star, CalendarCheck,
  UserCircle, Sparkle, VideoCamera, X,
} from "@phosphor-icons/react";
import { formatDateTime } from "@/lib/utils";

interface Story {
  id: string;
  type: string;
  customerName: string | null;
  content: string;
  service: string | null;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: string;
}

const STORY_TYPES = [
  { value: "testimonial", label: "Phản hồi khách hàng", icon: Star },
  { value: "result", label: "Kết quả điều trị", icon: CheckCircle },
  { value: "event", label: "Sự kiện tại spa", icon: CalendarCheck },
  { value: "staff", label: "Giới thiệu nhân viên", icon: UserCircle },
  { value: "behind-scenes", label: "Hậu trường spa", icon: VideoCamera },
];

function typeIcon(type: string) {
  const found = STORY_TYPES.find((t) => t.value === type);
  const Icon = found?.icon ?? Star;
  return <Icon size={13} weight="fill" />;
}

function typeLabel(type: string) {
  return STORY_TYPES.find((t) => t.value === type)?.label ?? type;
}

const BLANK = { type: "testimonial", customerName: "", content: "", service: "", imageUrl: "" };

export function StoryManager() {
  const { selectedPageId } = useActivePage();
  const [stories, setStories] = useState<Story[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Story | null>(null);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const q = selectedPageId ? `?facebookPageId=${selectedPageId}&active=false` : "?active=false";
    const res = await fetch(`/api/stories${q}`);
    const data = await res.json();
    if (data.success) setStories(data.data);
  }, [selectedPageId]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(BLANK);
    setError("");
    setShowForm(true);
  };

  const openEdit = (story: Story) => {
    setEditing(story);
    setForm({
      type: story.type,
      customerName: story.customerName ?? "",
      content: story.content,
      service: story.service ?? "",
      imageUrl: story.imageUrl ?? "",
    });
    setError("");
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.content.trim()) { setError("Vui lòng nhập nội dung câu chuyện"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: editing ? "update" : "create",
          ...(editing ? { id: editing.id } : {}),
          facebookPageId: selectedPageId || null,
          ...form,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setShowForm(false);
      setEditing(null);
      await load();
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      await load();
    } finally { setDeleting(null); }
  };

  const toggleActive = async (story: Story) => {
    await fetch("/api/stories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", id: story.id, isActive: !story.isActive }),
    });
    await load();
  };

  const activeCount = stories.filter((s) => s.isActive).length;

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Stats bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl px-4 py-2.5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <p className="text-xl font-bold" style={{ color: "var(--text)" }}>{stories.length}</p>
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Tổng câu chuyện</p>
          </div>
          <div className="rounded-xl px-4 py-2.5" style={{ background: "var(--accent-light)" }}>
            <p className="text-xl font-bold" style={{ color: "var(--accent)" }}>{activeCount}</p>
            <p className="text-[10px]" style={{ color: "var(--accent)" }}>Đang dùng cho AI</p>
          </div>
        </div>
        <Button onClick={openCreate}>
          <Plus size={14} weight="bold" /> Thêm câu chuyện
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editing ? "Chỉnh sửa câu chuyện" : "Thêm câu chuyện mới"}</CardTitle>
            <button onClick={() => setShowForm(false)}>
              <X size={16} style={{ color: "var(--text-muted)" }} />
            </button>
          </CardHeader>
          <div className="space-y-3">
            <Select
              label="Loại câu chuyện"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              {STORY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Tên khách hàng / nhân vật (tùy chọn)"
                placeholder="VD: Chị Lan, anh Tuấn..."
                value={form.customerName}
                onChange={(e) => setForm({ ...form, customerName: e.target.value })}
              />
              <Input
                label="Dịch vụ liên quan (tùy chọn)"
                placeholder="VD: Trẻ hóa da, Triệt lông..."
                value={form.service}
                onChange={(e) => setForm({ ...form, service: e.target.value })}
              />
            </div>

            <Textarea
              label="Nội dung câu chuyện"
              placeholder={
                form.type === "testimonial"
                  ? "VD: Chị Lan đến với da mụn trứng cá nặng 5 năm. Sau 2 tháng điều trị bằng liệu trình Phục hồi chuyên sâu, da chị cải thiện rõ rệt — mụn giảm 80%, da sáng và căng bóng hơn. Chị chia sẻ: 'Tôi không ngờ hiệu quả lại nhanh như vậy, tôi đã thử nhiều nơi trước đó mà không được'"
                  : form.type === "result"
                  ? "VD: Khách hàng 45 tuổi, da chảy xệ vùng cằm và cổ sau 3 tháng điều trị Nâng cơ HIFU — đo đường cằm giảm 2cm, da săn chắc rõ ràng khi chụp ảnh trước/sau..."
                  : form.type === "event"
                  ? "VD: Cuối tuần vừa rồi spa tổ chức Ngày Chăm Sóc Da Miễn Phí — 60 khách đến check da, phát hiện 80% bị thiếu độ ẩm mùa lạnh. Nhiều bạn bất ngờ khi biết mình đang dùng sai sản phẩm..."
                  : form.type === "staff"
                  ? "VD: Kỹ thuật viên Hương có 8 năm kinh nghiệm chuyên điều trị nám và tàn nhang. Chị tốt nghiệp trường Da liễu TP.HCM và từng tu nghiệp tại Hàn Quốc. Điểm đặc biệt: chị có khả năng đọc da rất chính xác chỉ qua quan sát..."
                  : "VD: Mỗi sáng trước khi đón khách, đội ngũ chúng tôi họp 15 phút để cập nhật tình trạng da từng khách quen. Đây là lý do tại sao khách đến lần 2 luôn cảm thấy được chăm sóc 'như người thân'..."
              }
              rows={5}
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
            />

            <Input
              label="URL hình ảnh minh họa (tùy chọn)"
              placeholder="https://..."
              value={form.imageUrl}
              onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
            />

            {error && (
              <p className="text-xs p-2 rounded" style={{ background: "var(--rose-light)", color: "var(--rose)" }}>{error}</p>
            )}

            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setShowForm(false)} className="flex-1">Hủy</Button>
              <Button onClick={handleSave} loading={saving} className="flex-1">
                <Sparkle size={13} weight="fill" /> {editing ? "Lưu thay đổi" : "Thêm câu chuyện"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Story list */}
      {stories.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <Star size={36} className="mb-3 opacity-20" style={{ color: "var(--text-secondary)" }} weight="fill" />
            <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>Chưa có câu chuyện nào</p>
            <p className="text-xs mt-1 max-w-xs" style={{ color: "var(--text-muted)" }}>
              Thêm phản hồi khách hàng, kết quả điều trị, hoặc sự kiện tại spa — AI sẽ kết hợp vào bài viết để nội dung thật hơn.
            </p>
            <Button onClick={openCreate} className="mt-4">
              <Plus size={13} weight="bold" /> Thêm câu chuyện đầu tiên
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {stories.map((story) => (
            <div
              key={story.id}
              className="rounded-xl p-4 flex gap-3 transition-opacity"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                opacity: story.isActive ? 1 : 0.55,
              }}
            >
              {/* Type icon */}
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: story.isActive ? "var(--accent-light)" : "var(--bg-subtle)", color: story.isActive ? "var(--accent)" : "var(--text-muted)" }}
              >
                {typeIcon(story.type)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                    {typeLabel(story.type)}
                  </span>
                  {story.customerName && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--bg-subtle)", color: "var(--text-secondary)" }}>
                      {story.customerName}
                    </span>
                  )}
                  {story.service && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
                      {story.service}
                    </span>
                  )}
                </div>
                <p className="text-sm leading-relaxed line-clamp-3" style={{ color: "var(--text)" }}>{story.content}</p>
                <p className="text-[10px] mt-1.5" style={{ color: "var(--text-muted)" }}>{formatDateTime(story.createdAt)}</p>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-1.5 shrink-0">
                <button
                  onClick={() => toggleActive(story)}
                  className="text-[10px] px-2 py-1 rounded-lg font-medium transition-colors"
                  style={
                    story.isActive
                      ? { background: "var(--accent)", color: "white" }
                      : { background: "var(--bg-subtle)", color: "var(--text-muted)" }
                  }
                >
                  {story.isActive ? "Bật" : "Tắt"}
                </button>
                <button
                  onClick={() => openEdit(story)}
                  className="p-1.5 rounded-lg hover:opacity-70"
                  style={{ background: "var(--bg-subtle)", color: "var(--text-secondary)" }}
                >
                  <Pencil size={12} />
                </button>
                <button
                  onClick={() => handleDelete(story.id)}
                  disabled={deleting === story.id}
                  className="p-1.5 rounded-lg hover:opacity-70"
                  style={{ background: "var(--bg-subtle)", color: "var(--rose)" }}
                >
                  <Trash size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tips */}
      {stories.length > 0 && (
        <div className="rounded-xl p-4 text-xs space-y-1.5" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
          <p className="font-semibold" style={{ color: "var(--text-secondary)" }}>Mẹo dùng câu chuyện hiệu quả</p>
          <ul className="space-y-1" style={{ color: "var(--text-muted)" }}>
            <li>• Câu chuyện có tên khách hàng cụ thể (kể cả ẩn danh như "Chị A") tạo độ tin cậy cao hơn</li>
            <li>• Kết hợp số liệu cụ thể: "giảm 80% mụn", "da căng sau 3 tuần" → thuyết phục hơn lời hứa chung</li>
            <li>• Chỉ bật (Bật) những câu chuyện bạn muốn AI dùng ngay. Tắt những câu chuyện mùa cũ hoặc không còn phù hợp</li>
            <li>• Trong <strong>Viết bài</strong> → bật <strong>"Kết hợp câu chuyện thực tế"</strong> để AI tự chọn câu chuyện phù hợp nhất với dịch vụ</li>
          </ul>
        </div>
      )}
    </div>
  );
}
