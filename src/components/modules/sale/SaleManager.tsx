"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Flame, Snowflake, SunDim, CheckCircle, Plus, Sparkle, Trash, ArrowRight } from "@phosphor-icons/react";
import { truncate } from "@/lib/utils";
import type { LeadData, LeadStatsData } from "@/lib/customer-workspaces";

type Lead = LeadData;
type Stats = LeadStatsData;

const StageIcon = ({ s }: { s: string }) => {
  if (s === "hot") return <Flame size={12} weight="fill" style={{ color: "var(--rose)" }} />;
  if (s === "warm") return <SunDim size={12} weight="fill" style={{ color: "var(--amber)" }} />;
  if (s === "closed") return <CheckCircle size={12} weight="fill" style={{ color: "var(--accent)" }} />;
  return <Snowflake size={12} weight="fill" style={{ color: "var(--blue)" }} />;
};

const stageBadge = (s: string) => {
  if (s === "hot") return <Badge variant="danger">Nóng</Badge>;
  if (s === "warm") return <Badge variant="warning">Ấm</Badge>;
  if (s === "closed") return <Badge variant="success">Đã chốt</Badge>;
  return <Badge variant="neutral">Lạnh</Badge>;
};

export function SaleManager({
  initialLeads,
  initialStats,
  canMutate = true,
  canonical = false,
  initialStage = "",
  onStageChange,
  onMutate,
}: {
  initialLeads?: Lead[];
  initialStats?: Stats;
  canMutate?: boolean;
  canonical?: boolean;
  initialStage?: string;
  onStageChange?: (stage?: string) => void;
  onMutate?: () => void;
} = {}) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads ?? []);
  const [stats, setStats] = useState<Stats>(initialStats ?? { total: 0, hot: 0, warm: 0, cold: 0, closed: 0 });
  const [form, setForm] = useState({ name: "", phone: "", source: "facebook", service: "", stage: "cold", note: "" });
  const [showForm, setShowForm] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [scriptLoading, setScriptLoading] = useState<string | null>(null);
  const [script, setScript] = useState<{ id: string; text: string } | null>(null);
  const [filterStage, setFilterStage] = useState(initialStage);

  const load = () => fetch("/api/sale").then((r) => r.json()).then((res) => {
    if (res.data) { setLeads(res.data.leads); setStats(res.data.stats); }
  });

  useEffect(() => {
    if (!initialLeads) load();
  }, [initialLeads]);

  useEffect(() => {
    if (initialLeads) {
      setLeads(initialLeads);
      if (initialStats) setStats(initialStats);
      setFilterStage(initialStage);
    }
  }, [initialLeads, initialStage, initialStats]);

  const refreshData = () => {
    if (onMutate) onMutate();
    else load();
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setScoring(true);
    try {
      const scoreRes = await fetch("/api/sale", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "ai-score", ...form }) });
      const scoreData = await scoreRes.json();
      await fetch("/api/sale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", ...form, score: scoreData.data?.score || 50, stage: scoreData.data?.stage || form.stage }),
      });
      setForm({ name: "", phone: "", source: "facebook", service: "", stage: "cold", note: "" });
      setShowForm(false); refreshData();
    } finally { setScoring(false); }
  };

  const updateStage = async (lead: Lead, stage: string, note?: string) => {
    await fetch("/api/sale", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update-stage", id: lead.id, facebookPageId: lead.facebookPageId, stage, note }) });
    refreshData();
  };

  const getScript = async (lead: Lead) => {
    setScriptLoading(lead.id);
    try {
      const res = await fetch("/api/sale", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "consult-script", id: lead.id, facebookPageId: lead.facebookPageId }) });
      const data = await res.json();
      if (data.data) setScript({ id: lead.id, text: data.data.script });
    } finally { setScriptLoading(null); }
  };

  const deleteLead = async (lead: Lead) => {
    await fetch("/api/sale", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id: lead.id, facebookPageId: lead.facebookPageId }) });
    refreshData();
  };

  const filtered = filterStage ? leads.filter((l) => l.stage === filterStage) : leads;

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[{ label: "Tổng leads", value: stats.total, color: "var(--text)" }, { label: "Nóng", value: stats.hot, color: "var(--rose)" }, { label: "Ấm", value: stats.warm, color: "var(--amber)" }, { label: "Lạnh", value: stats.cold, color: "var(--blue)" }, { label: "Đã chốt", value: stats.closed, color: "var(--accent)" }].map(({ label, value, color }) => (
          <Card key={label}><p className="text-2xl font-bold" style={{ color }}>{value}</p><p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{label}</p></Card>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2">
          {["", "hot", "warm", "cold", "closed"].map((s) => (
            <Button key={s} size="sm" variant={filterStage === s ? "primary" : "secondary"} onClick={() => { setFilterStage(s); onStageChange?.(s || undefined); }}>
              {s === "" ? "Tất cả" : s === "hot" ? "Nóng" : s === "warm" ? "Ấm" : s === "cold" ? "Lạnh" : "Đã chốt"}
            </Button>
          ))}
        </div>
        {canMutate && !canonical ? <Button size="sm" onClick={() => setShowForm(!showForm)}><Plus size={12} /> Thêm lead</Button> : null}
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle>Thêm lead mới (AI tự chấm điểm)</CardTitle></CardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Tên khách *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="Điện thoại" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input label="Dịch vụ quan tâm" value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} />
            <Select label="Nguồn" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
              <option value="zalo">Zalo</option>
              <option value="walk-in">Walk-in</option>
              <option value="referral">Giới thiệu</option>
              <option value="other">Khác</option>
            </Select>
          </div>
          <Textarea label="Ghi chú" rows={2} className="mt-3" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <div className="flex gap-2 mt-3">
            <Button onClick={handleCreate} loading={scoring}><Sparkle size={13} weight="fill" /> AI chấm điểm & Thêm</Button>
            <Button variant="secondary" onClick={() => setShowForm(false)}>Huỷ</Button>
          </div>
        </Card>
      )}

      {script && (
        <Card>
          <CardHeader>
            <CardTitle>Kịch bản tư vấn</CardTitle>
            <Button size="sm" variant="secondary" onClick={() => setScript(null)}>Đóng</Button>
          </CardHeader>
          <p className="text-xs whitespace-pre-line" style={{ color: "var(--text-secondary)" }}>{script.text}</p>
        </Card>
      )}

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <Card><p className="text-xs text-center py-12" style={{ color: "var(--text-muted)" }}>Chưa có lead. Nhấn "Thêm lead" để bắt đầu.</p></Card>
        ) : (
          filtered.map((l) => (
            <Card key={l.id}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <StageIcon s={l.stage} />
                    <span className="text-sm font-medium" style={{ color: "var(--text)" }}>{l.name}</span>
                    {stageBadge(l.stage)}
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}>Score: {l.score}</span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-[11px]" style={{ color: "var(--text-muted)" }}>
                    {l.phone && <span>📞 {l.phone}</span>}
                    {l.service && <span>💆 {l.service}</span>}
                    <span>📍 {l.source}</span>
                  </div>
                  {l.note && <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{truncate(l.note, 80)}</p>}
                </div>
                <div className="flex gap-1 shrink-0 flex-wrap justify-end">
                  {canMutate && l.stage !== "hot" && l.stage !== "closed" && (
                    <Button size="sm" variant="secondary" onClick={() => updateStage(l, l.stage === "cold" ? "warm" : "hot")}>
                      <ArrowRight size={11} /> {l.stage === "cold" ? "Ấm" : "Nóng"}
                    </Button>
                  )}
                  {canMutate && l.stage === "hot" && (
                    <Button size="sm" onClick={() => updateStage(l, "closed", "Đã chốt sale")}><CheckCircle size={11} weight="fill" /> Chốt</Button>
                  )}
                  {canMutate ? <Button size="sm" variant="secondary" loading={scriptLoading === l.id} onClick={() => getScript(l)}><Sparkle size={11} /></Button> : null}
                  {canMutate ? <Button size="sm" variant="danger" onClick={() => deleteLead(l)}><Trash size={11} /></Button> : null}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
