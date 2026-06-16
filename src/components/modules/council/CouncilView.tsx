"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { ChatsTeardrop, Sparkle, Lightning, ArrowsClockwise, CheckCircle } from "@phosphor-icons/react";

interface Turn {
  speaker: string;
  provider: "claude" | "openai";
  persona: string;
  content: string;
}

interface CouncilResult {
  topic: string;
  turns: Turn[];
  synthesis: string;
  synthesisBy: "claude" | "openai";
}

const QUICK_TOPICS = [
  "Tháng này nên đẩy mạnh dịch vụ nào dựa trên xu hướng?",
  "Ngân sách 10 triệu/tháng cho FB Ads — phân bổ thế nào tối ưu?",
  "Khách quay lại lần 2 thấp — nên làm gì để tăng retention?",
  "Đối thủ giảm giá mạnh — mình có nên giảm theo không?",
  "Caption thế nào để chuyển đổi inbox cao hơn?",
  "Có nên mở thêm dịch vụ nail bên cạnh facial không?",
];

export function CouncilView() {
  const [topic, setTopic] = useState("");
  const [context, setContext] = useState("");
  const [mode, setMode] = useState<"full" | "quick">("full");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CouncilResult | null>(null);

  const handleAsk = async () => {
    if (!topic.trim()) { setError("Nhập câu hỏi/chủ đề trước"); return; }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/council", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, context, mode }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setResult(data.data);
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Intro card */}
      <div
        className="rounded-2xl p-5 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, var(--premium) 0%, var(--premium-hover) 100%)",
          boxShadow: "var(--shadow-premium)",
        }}
      >
        <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full opacity-10" style={{ background: "white" }} />
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.2)" }}>
              <ChatsTeardrop size={18} weight="fill" color="white" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.7)" }}>AI Council</p>
              <p className="text-base font-bold leading-tight" style={{ color: "white" }}>Bàn luận chiến lược 2 AI</p>
            </div>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.92)" }}>
            Đặt câu hỏi chiến lược — Claude đề xuất, GPT phản biện, một AI tổng hợp quyết định cuối.
            Bạn sẽ thấy toàn bộ tranh luận → hiểu tại sao có kết luận đó.
          </p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Đặt câu hỏi cho Council</CardTitle>
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: "var(--bg-subtle)" }}>
            <button
              onClick={() => setMode("full")}
              className="text-[11px] font-medium px-2.5 py-1 rounded-md transition-all"
              style={mode === "full" ? { background: "var(--accent)", color: "white" } : { color: "var(--text-secondary)" }}
            >
              Full debate
            </button>
            <button
              onClick={() => setMode("quick")}
              className="text-[11px] font-medium px-2.5 py-1 rounded-md transition-all"
              style={mode === "quick" ? { background: "var(--accent)", color: "white" } : { color: "var(--text-secondary)" }}
            >
              Quick critique
            </button>
          </div>
        </CardHeader>

        <div className="space-y-3">
          <Textarea
            label="Câu hỏi hoặc chủ đề chiến lược"
            placeholder="VD: Tháng này nên focus vào dịch vụ trẻ hóa da hay nail? Ngân sách ads 10 triệu phân bổ thế nào?..."
            rows={2}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
          <Textarea
            label="Bối cảnh thêm (tùy chọn)"
            placeholder="VD: Đang vào mùa hè, doanh thu tháng trước 50tr, top dịch vụ là facial cơ bản..."
            rows={3}
            value={context}
            onChange={(e) => setContext(e.target.value)}
          />

          {/* Quick topic chips */}
          <div>
            <p className="text-[10px] font-semibold mb-2 uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Gợi ý câu hỏi
            </p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TOPICS.map((t, i) => (
                <button
                  key={i}
                  onClick={() => setTopic(t)}
                  className="text-[11px] px-2.5 py-1 rounded-full transition-opacity hover:opacity-80"
                  style={{ background: "var(--accent-light)", color: "var(--accent)" }}
                >
                  {t.slice(0, 50)}{t.length > 50 ? "..." : ""}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-xs p-2 rounded" style={{ background: "var(--rose-light)", color: "var(--rose)" }}>{error}</p>
          )}

          <Button onClick={handleAsk} loading={loading} className="w-full">
            <Sparkle size={14} weight="fill" /> Bắt đầu bàn luận
          </Button>
        </div>
      </Card>

      {/* Loading hint */}
      {loading && (
        <Card>
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <ArrowsClockwise size={28} className="mb-3 animate-spin" style={{ color: "var(--accent)" }} />
            <p className="text-sm font-medium" style={{ color: "var(--text)" }}>2 AI đang bàn luận...</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              {mode === "full" ? "Full debate ~30-45s (4 vòng trao đổi + tổng hợp)" : "Quick critique ~15-20s (1 vòng)"}
            </p>
          </div>
        </Card>
      )}

      {/* Result */}
      {result && !loading && (
        <>
          {/* Synthesis */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CheckCircle size={16} weight="fill" style={{ color: "var(--accent)" }} />
                <CardTitle>Kết luận cuối</CardTitle>
              </div>
              <Badge variant="success">
                Tổng hợp bởi {result.synthesisBy === "claude" ? "Claude" : "GPT"}
              </Badge>
            </CardHeader>
            <div
              className="rounded-xl p-4 text-sm leading-relaxed whitespace-pre-wrap"
              style={{ background: "var(--accent-light)", color: "var(--text)", border: "1px solid var(--accent)" }}
            >
              {result.synthesis}
            </div>
          </Card>

          {/* Full transcript — chat bubbles */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ChatsTeardrop size={16} weight="fill" style={{ color: "var(--blue)" }} />
                <CardTitle>Cuộc tranh luận ({result.turns.length} lượt)</CardTitle>
              </div>
              {/* Legend */}
              <div className="flex items-center gap-3 text-[10px]" style={{ color: "var(--text-muted)" }}>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "var(--accent)" }} />Claude</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "var(--blue)" }} />GPT</span>
              </div>
            </CardHeader>
            <div className="space-y-4">
              {result.turns.map((t, i) => {
                const isClaude = t.provider === "claude";
                const color = isClaude ? "var(--accent)" : "var(--blue)";
                const bgColor = isClaude ? "var(--accent-light)" : "var(--info-light)";
                return (
                  <div key={i} className={`flex gap-3 ${isClaude ? "" : "flex-row-reverse"}`}>
                    {/* Avatar */}
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[9px] font-bold"
                      style={{ background: color, color: "white" }}
                    >
                      {isClaude ? "C" : "G"}
                    </div>
                    {/* Bubble */}
                    <div className="flex-1 max-w-[85%]">
                      <p className="text-[10px] font-semibold mb-1" style={{ color, textAlign: isClaude ? "left" : "right" }}>
                        {t.speaker}
                      </p>
                      <div
                        className="rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap"
                        style={{
                          background: bgColor,
                          color: "var(--text)",
                          borderRadius: isClaude ? "4px 18px 18px 18px" : "18px 4px 18px 18px",
                        }}
                      >
                        {t.content}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
