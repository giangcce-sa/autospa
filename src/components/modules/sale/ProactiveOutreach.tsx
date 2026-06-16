"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  Sparkle, Heart, Cake, Crown, Star, ChatCircle, PaperPlaneTilt, ArrowsClockwise,
} from "@phosphor-icons/react";
import { formatDateTime, truncate } from "@/lib/utils";

interface Message {
  id: string;
  type: string;
  content: string;
  platform: string;
  status: string;
  sentAt: string | null;
  customer: { id: string; name: string; segment: string } | null;
}

interface Data {
  messages: Message[];
  byType: Record<string, number>;
  total: number;
}

const TYPE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  proactive_cold_reactivation: { label: "Khách lạnh", icon: ChatCircle, color: "var(--rose)" },
  proactive_birthday: { label: "Sinh nhật", icon: Cake, color: "var(--amber)" },
  proactive_vip_loyal: { label: "VIP loyal", icon: Crown, color: "var(--blue)" },
  proactive_post_nps: { label: "Khách yêu", icon: Heart, color: "var(--accent)" },
};

export function ProactiveOutreach() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<{ candidates: number; sent: number; skipped: number; errors: string[] } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/proactive-sales");
      const json = await res.json();
      if (json.success) setData(json.data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const runNow = async () => {
    setRunning(true);
    setRunResult(null);
    try {
      const res = await fetch("/api/proactive-sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run-now" }),
      });
      const json = await res.json();
      if (json.success) setRunResult(json.data);
      await load();
    } finally { setRunning(false); }
  };

  if (loading && !data) return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {[1,2,3,4].map(i => <div key={i} className="skeleton h-20 w-32 rounded-xl" />)}
      </div>
      <div className="skeleton h-10 rounded-xl" />
      <div className="skeleton h-48 rounded-xl" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Top: stats + run button */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {Object.entries(TYPE_META).map(([type, meta]) => {
            const count = data?.byType[type] ?? 0;
            const Icon = meta.icon;
            return (
              <div key={type} className="rounded-xl px-3 py-2.5 min-w-[120px]" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <Icon size={13} style={{ color: meta.color }} weight="fill" />
                <p className="text-xl font-bold mt-1" style={{ color: "var(--text)" }}>{count}</p>
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{meta.label}</p>
              </div>
            );
          })}
        </div>
        <Button onClick={runNow} loading={running}>
          <Sparkle size={13} weight="fill" /> Chạy proactive ngay
        </Button>
      </div>

      {runResult && (
        <div className="rounded-xl p-3 text-xs space-y-1" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
          <p className="font-semibold">Kết quả run: {runResult.candidates} ứng viên · {runResult.sent} đã gửi · {runResult.skipped} bỏ qua</p>
          {runResult.errors.length > 0 && (
            <p className="text-[11px]" style={{ color: "var(--rose)" }}>{runResult.errors.length} lỗi: {runResult.errors[0]}</p>
          )}
        </div>
      )}

      {/* Info card */}
      <div className="rounded-xl p-3 text-xs space-y-1" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
        <p className="font-semibold" style={{ color: "var(--text-secondary)" }}>Cách hoạt động</p>
        <ul style={{ color: "var(--text-muted)" }} className="space-y-0.5">
          <li>• Cold reactivation: khách &gt; 60 ngày không liên hệ → tin gợi lại + ưu đãi</li>
          <li>• Sinh nhật: trong 7 ngày tới → chúc mừng + voucher giảm 20%</li>
          <li>• VIP loyal: segment VIP + &gt; 30 ngày → cảm ơn + premium offer</li>
          <li>• Khách yêu: NPS &ge; 4 + chưa quay lại 45 ngày → mời tiếp tục trải nghiệm</li>
          <li>• Cron daily tự chạy. Max 30 tin/ngày. Cooldown 30 ngày/khách.</li>
          <li>• Chỉ chạy khi automation mode KHÁC <strong>supervised</strong> (vào Cài đặt để đổi).</li>
        </ul>
      </div>

      {/* Recent messages */}
      <Card>
        <CardHeader>
          <CardTitle>Tin nhắn đã gửi gần đây ({data?.total ?? 0})</CardTitle>
          <button onClick={load} className="text-xs flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
            <ArrowsClockwise size={11} /> Refresh
          </button>
        </CardHeader>
        {data?.messages.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>
            Chưa gửi proactive nào. Nhấn &ldquo;Chạy proactive ngay&rdquo; để bắt đầu.
          </p>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {data?.messages.map((m) => {
              const meta = TYPE_META[m.type];
              const Icon = meta?.icon ?? Star;
              return (
                <div key={m.id} className="flex items-start gap-3 py-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "var(--bg-subtle)" }}>
                    <Icon size={13} weight="fill" style={{ color: meta?.color ?? "var(--text-muted)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="font-medium text-sm" style={{ color: "var(--text)" }}>{m.customer?.name ?? "Khách"}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}>
                        {meta?.label ?? m.type}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}>
                        {m.platform}
                      </span>
                    </div>
                    <p className="text-xs leading-snug" style={{ color: "var(--text-secondary)" }}>{truncate(m.content, 150)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <PaperPlaneTilt size={11} weight="fill" style={{ color: "var(--accent)" }} />
                    <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                      {m.sentAt ? formatDateTime(m.sentAt) : "?"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
