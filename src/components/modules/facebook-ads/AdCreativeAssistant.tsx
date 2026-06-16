"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input, Textarea } from "@/components/ui/Input";
import {
  Sparkle, ChatsTeardrop, Target, Users, CurrencyCircleDollar, TrendUp,
  Copy, CheckCircle, CaretDown,
} from "@phosphor-icons/react";

interface Service { id: string; name: string; }

interface DebateTurn {
  speaker: string;
  provider: "claude" | "openai";
  content: string;
}

interface AdSpec {
  captions: { text: string; hashtags: string; tone: string }[];
  audience: { ageMin: number; ageMax: number; gender: string; locations: string[]; interests: string[]; };
  dailyBudget: number;
  durationDays: number;
  predictedCtr: number;
  predictedRoas: number;
  reasoning: string;
  council: { turns: DebateTurn[] };
}

function vnd(n: number) { return new Intl.NumberFormat("vi-VN").format(n) + "đ"; }

export function AdCreativeAssistant() {
  const [services, setServices] = useState<Service[]>([]);
  const [form, setForm] = useState({
    serviceId: "",
    dailyBudget: "",
    objective: "conversions",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [spec, setSpec] = useState<AdSpec | null>(null);
  const [error, setError] = useState("");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [showDebate, setShowDebate] = useState(false);

  useEffect(() => {
    fetch("/api/services").then((r) => r.json()).then((res) => {
      if (res.data) setServices(res.data.filter((s: Service & { active: boolean }) => s.active));
    });
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    setSpec(null);
    try {
      const res = await fetch("/api/ads-creative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: form.serviceId || undefined,
          dailyBudget: form.dailyBudget ? Number(form.dailyBudget) : undefined,
          objective: form.objective,
          notes: form.notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSpec(data.data);
    } finally { setLoading(false); }
  };

  const copyCaption = (idx: number, text: string, hashtags: string) => {
    navigator.clipboard.writeText(`${text}\n\n${hashtags}`);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkle size={16} style={{ color: "var(--accent)" }} weight="fill" />
            <CardTitle>AI Creative Assistant</CardTitle>
          </div>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>2 AI bàn luận → đề xuất spec ad</p>
        </CardHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Select label="Dịch vụ" value={form.serviceId} onChange={(e) => setForm({ ...form, serviceId: e.target.value })}>
              <option value="">Tất cả dịch vụ</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Select label="Mục tiêu" value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })}>
              <option value="conversions">Conversions (đặt lịch)</option>
              <option value="engagement">Engagement (like/share)</option>
              <option value="reach">Reach (tiếp cận)</option>
            </Select>
          </div>
          <Input
            label="Budget/ngày (VND, tùy chọn)"
            type="number"
            placeholder="200000"
            value={form.dailyBudget}
            onChange={(e) => setForm({ ...form, dailyBudget: e.target.value })}
          />
          <Textarea
            label="Ghi chú thêm (tùy chọn)"
            placeholder="VD: nhấn mạnh ưu đãi giảm 30%, đối tượng phụ nữ văn phòng..."
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          {error && <p className="text-xs p-2 rounded" style={{ background: "var(--rose-light)", color: "var(--rose)" }}>{error}</p>}
          <Button onClick={handleGenerate} loading={loading} className="w-full">
            <Sparkle size={14} weight="fill" /> AI Council đề xuất spec quảng cáo
          </Button>
        </div>
      </Card>

      {loading && (
        <Card>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Sparkle size={28} className="mb-2 animate-spin" style={{ color: "var(--accent)" }} weight="fill" />
            <p className="text-sm font-medium" style={{ color: "var(--text)" }}>2 AI đang bàn luận strategy ads...</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>~30-45s</p>
          </div>
        </Card>
      )}

      {spec && !loading && (
        <>
          {/* Summary metrics */}
          <div className="grid grid-cols-4 gap-2">
            <div className="rounded-xl p-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <CurrencyCircleDollar size={13} style={{ color: "var(--accent)" }} weight="fill" />
              <p className="text-base font-bold mt-1" style={{ color: "var(--text)" }}>{vnd(spec.dailyBudget)}</p>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Budget/ngày</p>
            </div>
            <div className="rounded-xl p-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <Target size={13} style={{ color: "var(--blue)" }} weight="fill" />
              <p className="text-base font-bold mt-1" style={{ color: "var(--text)" }}>{spec.durationDays} ngày</p>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Thời gian chạy</p>
            </div>
            <div className="rounded-xl p-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <TrendUp size={13} style={{ color: "var(--amber)" }} weight="fill" />
              <p className="text-base font-bold mt-1" style={{ color: "var(--text)" }}>{spec.predictedCtr.toFixed(1)}%</p>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>CTR dự kiến</p>
            </div>
            <div className="rounded-xl p-3" style={{ background: "var(--accent-light)" }}>
              <Sparkle size={13} style={{ color: "var(--accent)" }} weight="fill" />
              <p className="text-base font-bold mt-1" style={{ color: "var(--accent)" }}>{spec.predictedRoas.toFixed(1)}x</p>
              <p className="text-[10px]" style={{ color: "var(--accent)" }}>ROAS dự kiến</p>
            </div>
          </div>

          {/* Audience */}
          <Card>
            <CardHeader>
              <CardTitle>Audience đề xuất</CardTitle>
              <Users size={14} style={{ color: "var(--blue)" }} weight="fill" />
            </CardHeader>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Tuổi & giới tính</p>
                <p style={{ color: "var(--text)" }}>
                  {spec.audience.ageMin}-{spec.audience.ageMax} tuổi · {spec.audience.gender === "female" ? "Nữ" : spec.audience.gender === "male" ? "Nam" : "Tất cả"}
                </p>
              </div>
              <div>
                <p className="font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Khu vực</p>
                <p style={{ color: "var(--text)" }}>{spec.audience.locations.join(", ")}</p>
              </div>
              <div className="col-span-2">
                <p className="font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Sở thích</p>
                <div className="flex flex-wrap gap-1">
                  {spec.audience.interests.map((i, idx) => (
                    <span key={idx} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "var(--bg-subtle)", color: "var(--text)" }}>
                      {i}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Caption variants */}
          <Card>
            <CardHeader>
              <CardTitle>Caption variants ({spec.captions.length})</CardTitle>
            </CardHeader>
            <div className="space-y-3">
              {spec.captions.map((c, idx) => (
                <div
                  key={idx}
                  className="rounded-xl p-3 border"
                  style={{ background: "var(--bg-subtle)", borderColor: "var(--border)" }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
                      {c.tone}
                    </span>
                    <button
                      onClick={() => copyCaption(idx, c.text, c.hashtags)}
                      className="text-[11px] flex items-center gap-1 transition-opacity hover:opacity-80"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {copiedIdx === idx ? <CheckCircle size={12} weight="fill" /> : <Copy size={12} />}
                      {copiedIdx === idx ? "Đã copy" : "Copy"}
                    </button>
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap mb-2" style={{ color: "var(--text)" }}>
                    {c.text}
                  </p>
                  <p className="text-xs" style={{ color: "var(--accent)" }}>{c.hashtags}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Reasoning */}
          <Card>
            <CardHeader>
              <CardTitle>Lý do từ AI Council</CardTitle>
              <ChatsTeardrop size={14} style={{ color: "var(--accent)" }} weight="fill" />
            </CardHeader>
            <div className="rounded-xl p-3 text-sm leading-relaxed whitespace-pre-wrap" style={{ background: "var(--accent-light)", color: "var(--text)" }}>
              {spec.reasoning}
            </div>
            <button
              onClick={() => setShowDebate((v) => !v)}
              className="flex items-center gap-1 mt-2 text-[11px] font-medium"
              style={{ color: "var(--accent)" }}
            >
              {showDebate ? "Ẩn" : "Xem"} cuộc tranh luận đầy đủ
              <CaretDown size={10} style={{ transform: showDebate ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }} />
            </button>
            {showDebate && (
              <div className="mt-3 space-y-2">
                {spec.council.turns.map((t, i) => (
                  <div
                    key={i}
                    className="rounded-lg p-2.5 text-xs"
                    style={{
                      background: "var(--bg-subtle)",
                      borderLeft: `3px solid ${t.provider === "claude" ? "var(--accent)" : "var(--blue)"}`,
                    }}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: t.provider === "claude" ? "var(--accent)" : "var(--blue)" }}>
                      {t.speaker}
                    </p>
                    <p className="leading-snug" style={{ color: "var(--text-secondary)" }}>{t.content}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
