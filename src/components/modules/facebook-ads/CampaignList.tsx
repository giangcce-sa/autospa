"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { ArrowClockwise, PauseCircle, PlayCircle, PencilSimple, CheckCircle } from "@phosphor-icons/react";
import type { Campaign } from "@/lib/facebook-ads";

function fmt(n: string | undefined) { return n ? Number(n).toLocaleString("vi-VN") : "—"; }
function fmtVnd(n: string | undefined) { return n ? Number(n).toLocaleString("vi-VN") + "đ" : "—"; }
function pct(n: string | undefined) { return n ? Number(n).toFixed(2) + "%" : "—"; }

interface Props {
  facebookPageId?: string;
  initialCampaigns?: Campaign[];
  initialError?: string;
  canMutate?: boolean;
  canonical?: boolean;
}

export function CampaignList({ facebookPageId, initialCampaigns, initialError = "", canMutate = true, canonical = false }: Props) {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns ?? []);
  const [loading, setLoading] = useState(!initialCampaigns && !initialError);
  const [error, setError] = useState(initialError);
  const [acting, setActing] = useState<string | null>(null);
  const [editBudget, setEditBudget] = useState<{
    campaignId: string;
    targetId: string;
    targetType: "campaign" | "adset";
    value: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const url = `/api/facebook-ads?action=campaigns${facebookPageId ? `&facebookPageId=${facebookPageId}` : ""}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!data.success) { setError(data.error); return; }
      setCampaigns(data.data);
    } finally { setLoading(false); }
  }, [facebookPageId]);

  useEffect(() => {
    if (!canonical) load();
  }, [canonical, load]);

  useEffect(() => {
    if (canonical) {
      setCampaigns(initialCampaigns ?? []);
      setError(initialError);
      setLoading(false);
    }
  }, [canonical, initialCampaigns, initialError]);

  const toggleStatus = async (c: Campaign) => {
    setActing(c.id);
    try {
      const response = await fetch("/api/facebook-ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: c.status === "ACTIVE" ? "pause" : "resume",
          campaignId: c.id,
          facebookPageId,
        }),
      });
      const result = await response.json();
      if (!result.success) {
        setError(result.error ?? "Không thể cập nhật Campaign");
        return;
      }
      if (canonical) router.refresh();
      else await load();
    } finally { setActing(null); }
  };

  const saveBudget = async () => {
    if (!editBudget) return;
    setActing(editBudget.campaignId);
    try {
      const response = await fetch("/api/facebook-ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-budget",
          campaignId: editBudget.campaignId,
          targetId: editBudget.targetId,
          targetType: editBudget.targetType,
          dailyBudgetVnd: Number(editBudget.value.replace(/\D/g, "")),
          facebookPageId,
        }),
      });
      const result = await response.json();
      if (!result.success) {
        setError(result.error ?? "Không thể cập nhật ngân sách");
        return;
      }
      setEditBudget(null);
      if (canonical) router.refresh();
      else await load();
    } finally { setActing(null); }
  };

  const totalSpend = campaigns.reduce((s, c) => s + Number(c.spend ?? 0), 0);
  const totalReach = campaigns.reduce((s, c) => s + Number(c.reach ?? 0), 0);
  const active = campaigns.filter((c) => c.status === "ACTIVE").length;
  const avgCtr = campaigns.length
    ? campaigns.reduce((s, c) => s + Number(c.ctr ?? 0), 0) / campaigns.length
    : 0;

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Tổng chi", value: fmtVnd(String(totalSpend)) },
          { label: "Tổng reach", value: fmt(String(totalReach)) },
          { label: "Đang chạy", value: String(active) },
          { label: "CTR trung bình", value: avgCtr.toFixed(2) + "%" },
        ].map((s) => (
          <Card key={s.label}>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{s.label}</p>
            <p className="text-xl font-bold mt-0.5" style={{ color: "var(--text)" }}>{s.value}</p>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Chiến dịch ({campaigns.length})</CardTitle>
          <Button size="sm" variant="secondary" loading={loading} onClick={() => canonical ? router.refresh() : load()}>
            <ArrowClockwise size={13} /> Làm mới
          </Button>
        </CardHeader>

        {error && (
          <p className="text-xs p-3 rounded-lg mb-3" style={{ background: "var(--rose-light)", color: "var(--rose)" }}>{error}</p>
        )}

        {!error && campaigns.length === 0 && !loading && (
          <p className="text-xs text-center py-6" style={{ color: "var(--text-muted)" }}>
            Chưa có chiến dịch nào. Tạo chiến dịch đầu tiên trong tab <strong>Tạo quảng cáo</strong>.
          </p>
        )}

        {campaigns.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }}>
                  {["Tên chiến dịch", "Trạng thái", "Budget/ngày", "Đã chi", "Reach", "Clicks", "CTR", ""].map((h) => (
                    <th key={h} className="text-left py-2 px-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="py-2.5 px-2 font-medium max-w-[180px] truncate" style={{ color: "var(--text)" }}>{c.name}</td>
                    <td className="py-2.5 px-2">
                      <StatusBadge status={c.status === "ACTIVE" ? "published" : "draft"} />
                    </td>
                    <td className="py-2.5 px-2" style={{ color: "var(--text-secondary)" }}>
                      {editBudget?.campaignId === c.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            className="w-24 px-2 py-1 rounded border text-xs"
                            style={{ background: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text)" }}
                            value={editBudget.value}
                            onChange={(e) => setEditBudget((current) => current ? { ...current, value: e.target.value } : null)}
                          />
                          <button onClick={saveBudget} disabled={acting === c.id}><CheckCircle size={14} style={{ color: "var(--accent)" }} /></button>
                        </div>
                      ) : (
                        <span>{fmtVnd(c.budgetTarget?.dailyBudget)}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-2" style={{ color: "var(--text-secondary)" }}>{fmtVnd(c.spend)}</td>
                    <td className="py-2.5 px-2" style={{ color: "var(--text-secondary)" }}>{fmt(c.reach)}</td>
                    <td className="py-2.5 px-2" style={{ color: "var(--text-secondary)" }}>{fmt(c.clicks)}</td>
                    <td className="py-2.5 px-2" style={{ color: "var(--text-secondary)" }}>{pct(c.ctr)}</td>
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-1">
                        {canMutate ? (
                          <>
                            <button
                              onClick={() => toggleStatus(c)}
                              disabled={acting === c.id}
                              title={c.status === "ACTIVE" ? "Tạm dừng" : "Tiếp tục"}
                              style={{ color: c.status === "ACTIVE" ? "var(--amber)" : "var(--accent)" }}
                            >
                              {c.status === "ACTIVE" ? <PauseCircle size={16} /> : <PlayCircle size={16} />}
                            </button>
                            <button
                              onClick={() => c.budgetTarget && setEditBudget({
                                campaignId: c.id,
                                targetId: c.budgetTarget.id,
                                targetType: c.budgetTarget.type,
                                value: c.budgetTarget.dailyBudget,
                              })}
                              disabled={!c.budgetTarget}
                              title={c.budgetIssue ?? "Sửa ngân sách"}
                              style={{ color: c.budgetTarget ? "var(--text-muted)" : "var(--border)" }}
                            >
                              <PencilSimple size={14} />
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
