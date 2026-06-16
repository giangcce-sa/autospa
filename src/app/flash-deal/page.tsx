"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Lightning, CalendarBlank, ChartBar, PaperPlaneTilt, ArrowsClockwise } from "@phosphor-icons/react";

interface SlotGap {
  date: string; label: string; hoursUntil: number;
  filledSlots: number; estimatedCapacity: number; fillRate: number;
}

interface DealPreview {
  slot: SlotGap; discountPct: number; service: string | null; caption: string; status: string;
  posted?: { facebook: boolean; zalo: boolean; telegram: boolean } | null;
}

function FillBar({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100);
  const color = rate < 0.3 ? "var(--danger)" : rate < 0.6 ? "var(--warning)" : "var(--success)";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-subtle)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[10px] tabular-nums font-semibold w-8" style={{ color }}>{pct}%</span>
    </div>
  );
}

export default function FlashDealPage() {
  const [gaps, setGaps] = useState<SlotGap[]>([]);
  const [deals, setDeals] = useState<DealPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [postingIdx, setPostingIdx] = useState<number | null>(null);

  const loadGaps = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/flash-deal");
    const json = await res.json();
    if (json.success) setGaps(json.data.gaps);
    setLoading(false);
  }, []);

  useEffect(() => { loadGaps(); }, [loadGaps]);

  const detect = async () => {
    setDetecting(true);
    setDeals([]);
    const res = await fetch("/api/flash-deal", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "detect" }),
    });
    const json = await res.json();
    if (json.success) setDeals(json.data.deals ?? []);
    setDetecting(false);
  };

  const postDeal = async (idx: number, caption: string) => {
    setPostingIdx(idx);
    const res = await fetch("/api/flash-deal", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "post", caption }),
    });
    const json = await res.json();
    if (json.success) {
      setDeals(prev => prev.map((d, i) => i === idx ? { ...d, status: "posted", posted: json.data } : d));
    }
    setPostingIdx(null);
  };

  return (
    <>
      <PageHeader title="Flash Deal Engine" description="Tự động phát hiện slot trống và tạo deal hấp dẫn để lấp lịch" />

      <div className="space-y-4 max-w-4xl">
        {/* Slot overview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {loading ? [1,2,3].map(i => <div key={i} className="skeleton h-24 rounded-xl" />) :
            gaps.length === 0 ? (
              <Card className="sm:col-span-3">
                <div className="flex flex-col items-center py-8 text-center">
                  <CalendarBlank size={32} className="mb-2 opacity-20" style={{ color: "var(--text-muted)" }} />
                  <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>Lịch đang đầy</p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Không có slot trống đáng kể trong 48h tới</p>
                </div>
              </Card>
            ) : gaps.map(gap => (
              <Card key={gap.date}>
                <div className="flex items-center gap-2 mb-2">
                  <CalendarBlank size={14} weight="fill" style={{ color: gap.fillRate < 0.4 ? "var(--danger)" : "var(--warning)" }} />
                  <p className="text-xs font-semibold" style={{ color: "var(--text)" }}>{gap.label}</p>
                </div>
                <FillBar rate={gap.fillRate} />
                <div className="flex justify-between mt-2 text-[10px]" style={{ color: "var(--text-muted)" }}>
                  <span>{gap.filledSlots}/{gap.estimatedCapacity} slot đã đặt</span>
                  <span style={{ color: "var(--warning)" }}>còn {gap.hoursUntil}h</span>
                </div>
              </Card>
            ))
          }
        </div>

        {/* Action */}
        <div className="flex gap-2">
          <Button onClick={detect} loading={detecting} disabled={gaps.length === 0}>
            <Lightning size={14} weight="fill" /> Tạo Flash Deal AI
          </Button>
          <Button variant="secondary" onClick={loadGaps} loading={loading}>
            <ArrowsClockwise size={14} /> Làm mới
          </Button>
        </div>

        {/* Generated deals */}
        {deals.map((deal, idx) => (
          <Card key={idx}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Lightning size={14} weight="fill" style={{ color: "var(--warning)" }} />
                <CardTitle>{deal.slot.label} — Giảm {deal.discountPct}%{deal.service ? ` · ${deal.service}` : ""}</CardTitle>
              </div>
              {deal.status === "posted" && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--success-light)", color: "var(--success)" }}>
                  Đã đăng
                </span>
              )}
            </CardHeader>

            {/* Metrics */}
            <div className="flex gap-3 mb-3 text-[10px]" style={{ color: "var(--text-muted)" }}>
              <span><ChartBar size={10} className="inline mr-0.5" />Lịch trống: {Math.round((1 - deal.slot.fillRate) * 100)}%</span>
              <span>Còn {deal.slot.hoursUntil}h</span>
              <span>Discount: {deal.discountPct}%</span>
            </div>

            {/* Caption preview */}
            <div className="rounded-xl p-3 mb-3 text-xs whitespace-pre-wrap" style={{ background: "var(--bg-subtle)", color: "var(--text)", lineHeight: 1.6 }}>
              {deal.caption}
            </div>

            {/* Post result */}
            {deal.posted && (
              <div className="flex gap-2 mb-3 text-[10px]">
                {[
                  { key: "facebook", label: "Facebook" },
                  { key: "zalo", label: "Zalo" },
                  { key: "telegram", label: "Telegram" },
                ].map(ch => (
                  <span key={ch.key} className="px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: deal.posted![ch.key as keyof typeof deal.posted] ? "var(--success-light)" : "var(--bg-subtle)", color: deal.posted![ch.key as keyof typeof deal.posted] ? "var(--success)" : "var(--text-muted)" }}>
                    {ch.label} {deal.posted![ch.key as keyof typeof deal.posted] ? "✓" : "—"}
                  </span>
                ))}
              </div>
            )}

            {deal.status !== "posted" && (
              <Button size="sm" onClick={() => postDeal(idx, deal.caption)} loading={postingIdx === idx}>
                <PaperPlaneTilt size={12} /> Đăng ngay (Facebook + Zalo + Telegram)
              </Button>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}
