"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  Plus, Pencil, Trash, X, FacebookLogo, Lightning, PlayCircle, CheckCircle, XCircle,
} from "@phosphor-icons/react";

interface Rule {
  id: string;
  trigger: string;
  reply: string;
  matchMode: string;
  priority: number;
  channel: string;
  isActive: boolean;
  createdAt: string;
}

const MATCH_MODES = [
  { value: "contains", label: "Chứa (substring)" },
  { value: "exact", label: "Trùng tuyệt đối" },
  { value: "regex", label: "Regex pattern" },
];

const CHANNELS = [
  { value: "both", label: "FB + Zalo" },
  { value: "facebook", label: "Facebook" },
  { value: "zalo", label: "Zalo OA" },
];

const BLANK = { trigger: "", reply: "", matchMode: "contains", priority: 0, channel: "both" };

const QUICK_TEMPLATES = [
  { trigger: "giá", reply: "Cảm ơn bạn quan tâm! Spa có nhiều mức giá tùy dịch vụ — bạn để lại SĐT để nhân viên tư vấn chi tiết nhé 💚" },
  { trigger: "địa chỉ", reply: "Spa ở [địa chỉ spa]. Bạn có thể đến trực tiếp hoặc đặt lịch trước nhé!" },
  { trigger: "mở cửa", reply: "Spa mở cửa từ 9h-21h tất cả các ngày trong tuần. Bạn ghé bất kỳ lúc nào nhé!" },
  { trigger: "đặt lịch", reply: "Để đặt lịch, bạn cho mình xin tên + SĐT + dịch vụ muốn làm, mình sẽ sắp lịch luôn nhé 🌿" },
];

export function MessageRules() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Test playground
  const [testText, setTestText] = useState("");
  const [testChannel, setTestChannel] = useState<"facebook" | "zalo">("facebook");
  const [testResult, setTestResult] = useState<{ matched: boolean; reply?: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/message-rules");
    const data = await res.json();
    if (data.success) setRules(data.data);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(BLANK);
    setError("");
    setShowForm(true);
  };

  const openEdit = (rule: Rule) => {
    setEditing(rule);
    setForm({
      trigger: rule.trigger,
      reply: rule.reply,
      matchMode: rule.matchMode,
      priority: rule.priority,
      channel: rule.channel,
    });
    setError("");
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.trigger.trim() || !form.reply.trim()) {
      setError("Trigger và reply không được trống");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/message-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: editing ? "update" : "create",
          ...(editing ? { id: editing.id } : {}),
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

  const toggle = async (id: string) => {
    await fetch("/api/message-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle", id }),
    });
    await load();
  };

  const remove = async (id: string) => {
    await fetch("/api/message-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    await load();
  };

  const applyTemplate = (tpl: typeof QUICK_TEMPLATES[0]) => {
    setForm({ ...form, trigger: tpl.trigger, reply: tpl.reply });
  };

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/message-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", text: testText, channel: testChannel }),
      });
      const data = await res.json();
      setTestResult({ matched: !!data.data, reply: data.data?.reply });
    } finally { setTesting(false); }
  };

  const channelIcon = (ch: string) => {
    if (ch === "facebook") return <FacebookLogo size={11} color="#1877F2" weight="fill" />;
    if (ch === "zalo") return <Lightning size={11} style={{ color: "var(--blue)" }} weight="fill" />;
    return (
      <span className="inline-flex gap-0.5">
        <FacebookLogo size={11} color="#1877F2" weight="fill" />
        <Lightning size={11} style={{ color: "var(--blue)" }} weight="fill" />
      </span>
    );
  };

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Top stats + add button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl px-4 py-2.5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <p className="text-xl font-bold" style={{ color: "var(--text)" }}>{rules.length}</p>
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Tổng rule</p>
          </div>
          <div className="rounded-xl px-4 py-2.5" style={{ background: "var(--accent-light)" }}>
            <p className="text-xl font-bold" style={{ color: "var(--accent)" }}>{rules.filter((r) => r.isActive).length}</p>
            <p className="text-[10px]" style={{ color: "var(--accent)" }}>Đang bật</p>
          </div>
        </div>
        <Button onClick={openCreate}>
          <Plus size={14} weight="bold" /> Thêm rule
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editing ? "Chỉnh sửa rule" : "Thêm rule mới"}</CardTitle>
            <button onClick={() => setShowForm(false)}>
              <X size={16} style={{ color: "var(--text-muted)" }} />
            </button>
          </CardHeader>

          {!editing && (
            <div className="mb-4 p-3 rounded-xl" style={{ background: "var(--bg-subtle)", border: "1px dashed var(--border)" }}>
              <p className="text-[10px] font-semibold mb-2 uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Mẫu nhanh</p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_TEMPLATES.map((t) => (
                  <button
                    key={t.trigger}
                    onClick={() => applyTemplate(t)}
                    className="text-[11px] px-2 py-1 rounded-lg transition-opacity hover:opacity-80"
                    style={{ background: "var(--accent-light)", color: "var(--accent)" }}
                  >
                    {t.trigger}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <Input
              label="Trigger (từ khóa khi khách nhắn)"
              placeholder="VD: giá, đặt lịch, mở cửa..."
              value={form.trigger}
              onChange={(e) => setForm({ ...form, trigger: e.target.value })}
            />
            <Textarea
              label="Reply (tin nhắn tự trả lời)"
              placeholder="VD: Cảm ơn bạn! Spa sẽ liên hệ ngay nhé..."
              rows={3}
              value={form.reply}
              onChange={(e) => setForm({ ...form, reply: e.target.value })}
            />
            <div className="grid grid-cols-3 gap-3">
              <Select label="Cách match" value={form.matchMode} onChange={(e) => setForm({ ...form, matchMode: e.target.value })}>
                {MATCH_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </Select>
              <Select label="Kênh" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
                {CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </Select>
              <Input
                label="Ưu tiên"
                type="number"
                value={String(form.priority)}
                onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
              />
            </div>
            {error && <p className="text-xs p-2 rounded" style={{ background: "var(--rose-light)", color: "var(--rose)" }}>{error}</p>}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setShowForm(false)} className="flex-1">Hủy</Button>
              <Button onClick={handleSave} loading={saving} className="flex-1">
                {editing ? "Lưu" : "Thêm rule"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Rules list */}
      {rules.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <ChatCircleDotsIcon />
            <p className="font-semibold text-sm mt-3" style={{ color: "var(--text)" }}>Chưa có rule nào</p>
            <p className="text-xs mt-1 max-w-xs" style={{ color: "var(--text-muted)" }}>
              Thêm rule để tool tự trả lời khi khách hỏi câu lặp như &ldquo;giá bao nhiêu&rdquo;, &ldquo;địa chỉ&rdquo;, &ldquo;mở cửa mấy giờ&rdquo;...
            </p>
            <Button onClick={openCreate} className="mt-4">
              <Plus size={13} weight="bold" /> Thêm rule đầu tiên
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="rounded-xl p-4 flex gap-3 transition-opacity"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                opacity: rule.isActive ? 1 : 0.55,
              }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: rule.isActive ? "var(--accent-light)" : "var(--bg-subtle)" }}
              >
                {channelIcon(rule.channel)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                    {MATCH_MODES.find((m) => m.value === rule.matchMode)?.label}
                  </span>
                  {rule.priority !== 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--amber-light)", color: "var(--amber)" }}>
                      Ưu tiên {rule.priority}
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium leading-snug" style={{ color: "var(--text)" }}>
                  Khi khách nhắn: <span className="text-[var(--accent)]">&ldquo;{rule.trigger}&rdquo;</span>
                </p>
                <p className="text-xs leading-relaxed mt-1" style={{ color: "var(--text-secondary)" }}>
                  → {rule.reply}
                </p>
              </div>

              <div className="flex flex-col gap-1.5 shrink-0">
                <button
                  onClick={() => toggle(rule.id)}
                  className="text-[10px] px-2 py-1 rounded-lg font-medium"
                  style={rule.isActive
                    ? { background: "var(--accent)", color: "white" }
                    : { background: "var(--bg-subtle)", color: "var(--text-muted)" }}
                >
                  {rule.isActive ? "Bật" : "Tắt"}
                </button>
                <button
                  onClick={() => openEdit(rule)}
                  className="p-1.5 rounded-lg hover:opacity-70"
                  style={{ background: "var(--bg-subtle)", color: "var(--text-secondary)" }}
                >
                  <Pencil size={12} />
                </button>
                <button
                  onClick={() => remove(rule.id)}
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

      {/* Test playground */}
      {rules.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Test rule matching</CardTitle>
            <PlayCircle size={15} style={{ color: "var(--accent)" }} weight="fill" />
          </CardHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Input
                placeholder="Nhập tin nhắn thử như khách gửi..."
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
              />
              <Select value={testChannel} onChange={(e) => setTestChannel(e.target.value as "facebook" | "zalo")}>
                <option value="facebook">FB</option>
                <option value="zalo">Zalo</option>
              </Select>
            </div>
            <Button onClick={runTest} loading={testing} disabled={!testText.trim()} variant="secondary" className="w-full">
              <PlayCircle size={13} weight="fill" /> Test
            </Button>
            {testResult && (
              <div
                className="rounded-lg p-3 flex items-start gap-2"
                style={testResult.matched
                  ? { background: "var(--accent-light)", color: "var(--accent)" }
                  : { background: "var(--rose-light)", color: "var(--rose)" }}
              >
                {testResult.matched ? <CheckCircle size={14} weight="fill" /> : <XCircle size={14} weight="fill" />}
                <div className="text-xs">
                  {testResult.matched ? (
                    <>
                      <p className="font-semibold">Có rule match — bot sẽ trả lời:</p>
                      <p className="mt-1 italic">&ldquo;{testResult.reply}&rdquo;</p>
                    </>
                  ) : (
                    <p className="font-semibold">Không rule nào match. Tin nhắn sẽ chuyển sang Lead Agent hoặc AI fallback.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function ChatCircleDotsIcon() {
  // simple inline avoid extra import
  return (
    <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "var(--bg-subtle)" }}>
      <span className="text-lg">💬</span>
    </div>
  );
}
