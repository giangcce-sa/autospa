"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Sparkle, CalendarStar, Copy, CheckCircle } from "@phosphor-icons/react";

interface Holiday {
  id: string;
  name: string;
  date: string;
  description: string | null;
  daysUntil: number;
  isActive: boolean;
}

export function HolidayCalendar() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [generating, setGenerating] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = () =>
    fetch("/api/holidays").then((r) => r.json()).then((res) => res.data && setHolidays(res.data));

  useEffect(() => { load(); }, []);

  const handleGenerate = async (h: Holiday) => {
    setGenerating(h.id);
    setError("");
    try {
      const res = await fetch("/api/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate-content", holidayId: h.id }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setResults((prev) => ({ ...prev, [h.id]: data.data.content }));
    } finally { setGenerating(null); }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleToggle = async (id: string) => {
    await fetch("/api/holidays", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "toggle", holidayId: id }) });
    load();
  };

  const urgency = (days: number) => {
    if (days <= 7) return "danger";
    if (days <= 30) return "warning";
    return "info";
  };

  return (
    <div className="space-y-4 max-w-4xl">
      {error && <p className="text-xs p-2 rounded" style={{ background: "var(--rose-light)", color: "var(--rose)" }}>{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {holidays.slice(0, 3).map((h) => (
          <Card key={h.id} style={{ borderColor: h.daysUntil <= 7 ? "var(--rose)" : h.daysUntil <= 30 ? "var(--amber)" : "var(--border)" }}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <CalendarStar size={16} style={{ color: h.daysUntil <= 7 ? "var(--rose)" : "var(--accent)" }} weight="fill" />
                <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>{h.name}</p>
              </div>
              <Badge variant={urgency(h.daysUntil)}>
                {h.daysUntil === 0 ? "Hôm nay!" : `${h.daysUntil} ngày`}
              </Badge>
            </div>
            {h.description && <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>{h.description}</p>}
            <Button size="sm" onClick={() => handleGenerate(h)} loading={generating === h.id} className="w-full">
              <Sparkle size={12} weight="fill" /> Tạo content
            </Button>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tất cả dịp đặc biệt</CardTitle>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{holidays.filter(h => h.isActive).length} đang bật</span>
        </CardHeader>
        <div className="space-y-1">
          {holidays.map((h) => (
            <div key={h.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:opacity-80" style={{ background: "var(--bg-subtle)" }}>
              <button onClick={() => handleToggle(h.id)} className="w-4 h-4 rounded border flex items-center justify-center shrink-0" style={{ borderColor: h.isActive ? "var(--accent)" : "var(--border)", background: h.isActive ? "var(--accent)" : "transparent" }}>
                {h.isActive && <CheckCircle size={12} color="white" weight="fill" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium" style={{ color: "var(--text)" }}>{h.name}</p>
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{h.date} - còn {h.daysUntil} ngày</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => handleGenerate(h)} loading={generating === h.id}>
                <Sparkle size={11} />
              </Button>
            </div>
          ))}
        </div>
      </Card>

      {Object.entries(results).map(([id, content]) => {
        const holiday = holidays.find((h) => h.id === id);
        return (
          <Card key={id}>
            <CardHeader>
              <CardTitle>Content cho {holiday?.name}</CardTitle>
              <Button size="sm" variant="secondary" onClick={() => handleCopy(id, content)}>
                {copied === id ? <CheckCircle size={12} weight="fill" /> : <Copy size={12} />}
                {copied === id ? "Đã copy" : "Copy"}
              </Button>
            </CardHeader>
            <div className="p-3 rounded-lg text-xs whitespace-pre-wrap leading-relaxed" style={{ background: "var(--bg-subtle)", color: "var(--text-secondary)" }}>
              {content}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
