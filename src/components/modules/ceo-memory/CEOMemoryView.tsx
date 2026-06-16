"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import {
  Brain, CheckCircle, XCircle, Clock, MinusCircle, PencilSimple, X,
} from "@phosphor-icons/react";
import { formatDateTime, truncate } from "@/lib/utils";

interface Decision {
  id: string;
  date: string;
  topic: string;
  synthesis: string;
  source: string;
  outcomeMetric: string | null;
  outcomeBefore: number | null;
  outcomeAfter: number | null;
  outcomeStatus: string | null;
  outcomeNotes: string | null;
}

interface Counts {
  total: number;
  success: number;
  fail: number;
  pending: number;
}

const STATUS_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  success: { label: "Thành công", icon: CheckCircle, color: "var(--accent)" },
  fail: { label: "Thất bại", icon: XCircle, color: "var(--rose)" },
  neutral: { label: "Không rõ", icon: MinusCircle, color: "var(--text-muted)" },
  pending: { label: "Đang chờ", icon: Clock, color: "var(--amber)" },
};

const SOURCE_LABELS: Record<string, string> = {
  council: "Strategy Council",
  morning_brief: "Morning Brief",
  content_research: "Content Research",
  ab_test: "A/B Test Judge",
  manual: "Thủ công",
};

export function CEOMemoryView() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [overrideId, setOverrideId] = useState<string | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<"success" | "fail" | "neutral">("success");
  const [overrideNotes, setOverrideNotes] = useState("");
  const [overrideSaving, setOverrideSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = filter ? `?status=${filter}` : "";
      const res = await fetch(`/api/ceo-decisions${q}`);
      const json = await res.json();
      if (json.success) {
        setDecisions(json.data.decisions);
        setCounts(json.data.counts);
      }
    } finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const openOverride = (d: Decision) => {
    setOverrideId(d.id);
    setOverrideStatus((d.outcomeStatus as "success" | "fail" | "neutral") ?? "success");
    setOverrideNotes("");
  };

  const submitOverride = async () => {
    if (!overrideId) return;
    setOverrideSaving(true);
    try {
      const res = await fetch("/api/ceo-decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "override-outcome",
          id: overrideId,
          status: overrideStatus,
          notes: overrideNotes,
        }),
      });
      if (res.ok) {
        setOverrideId(null);
        setOverrideNotes("");
        await load();
      }
    } finally { setOverrideSaving(false); }
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <button
          onClick={() => setFilter(null)}
          className="rounded-xl p-4 text-left transition-all"
          style={filter === null
            ? { background: "var(--accent)", color: "white" }
            : { background: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          <Brain size={14} weight="fill" />
          <p className="text-xl font-bold mt-1">{counts?.total ?? 0}</p>
          <p className="text-[10px] opacity-80">Tổng quyết định</p>
        </button>
        {(["success", "fail", "pending"] as const).map((status) => {
          const meta = STATUS_META[status];
          const Icon = meta.icon;
          return (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className="rounded-xl p-4 text-left transition-all"
              style={filter === status
                ? { background: meta.color, color: "white" }
                : { background: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              <Icon size={14} weight="fill" style={{ color: filter === status ? "white" : meta.color }} />
              <p className="text-xl font-bold mt-1">{counts?.[status] ?? 0}</p>
              <p className="text-[10px] opacity-80">{meta.label}</p>
            </button>
          );
        })}
      </div>

      {/* Info */}
      <div className="rounded-xl p-3 text-xs space-y-1" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
        <p className="font-semibold" style={{ color: "var(--text-secondary)" }}>Cách hoạt động</p>
        <ul style={{ color: "var(--text-muted)" }} className="space-y-0.5">
          <li>• Mỗi cuộc bàn luận của AI Council (Morning Brief, Strategy Council, A/B Judge) tự lưu vào đây</li>
          <li>• Sau 7 ngày, tool tự đo kết quả thực tế (revenue, leads) và đánh giá thành công/thất bại</li>
          <li>• Lần tới Council bàn luận chủ đề tương tự → sẽ tham khảo các quyết định cũ + kết quả → quyết định thông minh hơn</li>
        </ul>
      </div>

      {/* Override modal */}
      {overrideId && (
        <Card>
          <CardHeader>
            <CardTitle>Override outcome</CardTitle>
            <button onClick={() => setOverrideId(null)}>
              <X size={16} style={{ color: "var(--text-muted)" }} />
            </button>
          </CardHeader>
          <div className="space-y-3">
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              AI tự đánh giá outcome dựa trên metric — nhưng đôi khi đúng/sai do yếu tố khác. Hãy override để CEO Memory chính xác hơn cho lần sau.
            </p>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                Outcome đúng là gì?
              </label>
              <div className="flex gap-2">
                {(["success", "fail", "neutral"] as const).map((s) => {
                  const meta = STATUS_META[s];
                  const Icon = meta.icon;
                  return (
                    <button
                      key={s}
                      onClick={() => setOverrideStatus(s)}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
                      style={overrideStatus === s
                        ? { background: meta.color, color: "white" }
                        : { background: "var(--bg-subtle)", color: "var(--text-secondary)" }}
                    >
                      <Icon size={12} weight="fill" /> {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <Textarea
              label="Lý do (tùy chọn, sẽ lưu vào Memory)"
              placeholder="VD: Doanh thu tăng nhưng vì đối thủ đóng cửa, không phải do quyết định này. Hoặc: Quyết định đúng, nhưng cần thực hiện sớm hơn 1 tuần."
              rows={3}
              value={overrideNotes}
              onChange={(e) => setOverrideNotes(e.target.value)}
            />
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setOverrideId(null)} className="flex-1">Hủy</Button>
              <Button onClick={submitOverride} loading={overrideSaving} className="flex-1">
                <PencilSimple size={12} /> Lưu override
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg skeleton shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-2/3" />
                  <div className="skeleton h-3 w-full" />
                  <div className="skeleton h-3 w-4/5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : decisions.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <Brain size={36} className="mb-3 opacity-20" style={{ color: "var(--text-secondary)" }} weight="fill" />
            <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>Chưa có quyết định nào</p>
            <p className="text-xs mt-1 max-w-sm" style={{ color: "var(--text-muted)" }}>
              Mở Morning Brief / Strategy Council / A/B Test Judge để Council bắt đầu lưu quyết định.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {decisions.map((d) => {
            const meta = STATUS_META[d.outcomeStatus ?? "neutral"];
            const Icon = meta.icon;
            return (
              <div
                key={d.id}
                className="rounded-xl p-4 transition-shadow hover:shadow-md"
                style={{
                  background: "var(--bg-card)",
                  border: `1px solid ${meta.color}33`,
                  borderLeft: `3px solid ${meta.color}`,
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: meta.color + "18" }}
                  >
                    <Icon size={14} weight="fill" style={{ color: meta.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>{d.topic}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}>
                        {SOURCE_LABELS[d.source] ?? d.source}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: meta.color + "22", color: meta.color }}>
                        {meta.label}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {truncate(d.synthesis, 280)}
                    </p>
                    {d.outcomeMetric && d.outcomeBefore !== null && (
                      <div
                        className="mt-2 text-[11px] flex items-center gap-2 px-2 py-1.5 rounded-lg"
                        style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}
                      >
                        <span><strong style={{ color: "var(--text-secondary)" }}>{d.outcomeMetric}</strong>: {d.outcomeBefore.toLocaleString("vi-VN")} → {d.outcomeAfter !== null ? d.outcomeAfter.toLocaleString("vi-VN") : "?"}</span>
                        {d.outcomeNotes && <span>· {d.outcomeNotes.slice(0, 80)}</span>}
                      </div>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{formatDateTime(d.date)}</p>
                      <button
                        onClick={() => openOverride(d)}
                        className="text-[10px] px-2 py-1 rounded-lg transition-opacity hover:opacity-80 flex items-center gap-1"
                        style={{ background: "var(--bg-subtle)", color: "var(--text-secondary)" }}
                      >
                        <PencilSimple size={10} /> Override
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
