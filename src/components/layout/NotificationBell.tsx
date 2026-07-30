"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { Bell, X, Checks, Info, Warning, Fire } from "@phosphor-icons/react";
import { Popover } from "@/components/ui/Popover";

interface Alert {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: "critical" | "warning" | "info";
  acknowledged: boolean;
  detectedAt: string;
}

function severityIcon(s: Alert["severity"]) {
  if (s === "critical") return <Fire size={12} weight="fill" style={{ color: "var(--danger)" }} />;
  if (s === "warning") return <Warning size={12} weight="fill" style={{ color: "var(--warning)" }} />;
  return <Info size={12} weight="fill" style={{ color: "var(--blue)" }} />;
}

function severityBorder(s: Alert["severity"]) {
  if (s === "critical") return "var(--danger)";
  if (s === "warning") return "var(--warning)";
  return "var(--blue)";
}

function timeAgo(ts: string): string {
  const ms = Date.now() - new Date(ts).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "vừa xong";
  if (m < 60) return `${m}ph trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h trước`;
  return `${Math.floor(h / 24)}d trước`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unack, setUnack] = useState(0);
  const [loading, setLoading] = useState(true);
  const [ackingAll, setAckingAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/realtime-alerts");
      const json = await res.json();
      if (json.success) {
        setAlerts(json.data.alerts ?? []);
        setUnack(json.data.unack ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Poll every 60s for new alerts
  useEffect(() => {
    const id = setInterval(() => { load(); }, 60000);
    return () => clearInterval(id);
  }, [load]);

  const acknowledge = async (id: string) => {
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, acknowledged: true } : a));
    setUnack((n) => Math.max(0, n - 1));
    await fetch("/api/realtime-alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "acknowledge", id }),
    });
  };

  const acknowledgeAll = async () => {
    setAckingAll(true);
    try {
      await fetch("/api/realtime-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "acknowledge-all" }),
      });
      setAlerts((prev) => prev.map((a) => ({ ...a, acknowledged: true })));
      setUnack(0);
    } finally { setAckingAll(false); }
  };

  const unread = alerts.filter((a) => !a.acknowledged);
  const read = alerts.filter((a) => a.acknowledged);

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      label="Thông báo"
      className="w-80"
      trigger={(triggerProps) => (
        <button
          {...triggerProps}
          type="button"
          className="relative flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-subtle)]"
          aria-label={unack > 0 ? `Thông báo, ${unack} chưa đọc` : "Thông báo"}
        >
          <Bell size={19} weight={unack > 0 ? "fill" : "regular"} style={{ color: unack > 0 ? "var(--warning)" : undefined }} aria-hidden="true" />
          {unack > 0 ? <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-md bg-[var(--danger)] px-1 text-[9px] font-bold text-white">{unack > 99 ? "99+" : unack}</span> : null}
        </button>
      )}
    >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2">
              <Bell size={14} weight="fill" style={{ color: "var(--warning)" }} />
              <p className="text-xs font-bold" style={{ color: "var(--text)" }}>Thông báo</p>
              {unack > 0 && (
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md" style={{ background: "var(--danger-light)", color: "var(--danger)" }}>
                  {unack} mới
                </span>
              )}
            </div>
            {unack > 0 && (
              <button
                type="button"
                onClick={acknowledgeAll}
                disabled={ackingAll}
                className="flex min-h-9 items-center gap-1 rounded-[var(--radius-sm)] px-2 text-[11px] font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--accent-light)] disabled:opacity-40"
              >
                <Checks size={13} aria-hidden="true" /> Đánh dấu tất cả
              </button>
            )}
          </div>

          {/* Body */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="space-y-2 p-3">
                {[1,2,3].map(i => <div key={i} className="skeleton h-14 rounded-md" />)}
              </div>
            ) : alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Bell size={28} className="mb-2 opacity-20" style={{ color: "var(--text-muted)" }} />
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Không có thông báo nào</p>
              </div>
            ) : (
              <div>
                {unread.length > 0 && (
                  <div>
                    <p className="px-4 pt-3 pb-1 text-[10px] font-semibold" style={{ color: "var(--text-muted)" }}>Chưa đọc</p>
                    {unread.map((a) => (
                      <AlertRow key={a.id} alert={a} onAck={acknowledge} />
                    ))}
                  </div>
                )}
                {read.length > 0 && (
                  <div>
                    <p className="px-4 pt-3 pb-1 text-[10px] font-semibold" style={{ color: "var(--text-muted)" }}>Đã đọc</p>
                    {read.slice(0, 10).map((a) => (
                      <AlertRow key={a.id} alert={a} onAck={acknowledge} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-[var(--border)] px-4 py-2.5 text-center">
            <Link href="/listening" onClick={() => setOpen(false)} className="inline-flex min-h-9 items-center text-[11px] font-semibold text-[var(--text-muted)] transition-colors hover:text-[var(--accent)]">
              Xem tất cả cảnh báo →
            </Link>
          </div>
    </Popover>
  );
}

function AlertRow({ alert, onAck }: { alert: Alert; onAck: (id: string) => void }) {
  return (
    <div
      className="flex items-start gap-2.5 px-4 py-2.5 transition-colors hover:bg-[var(--bg-subtle)] group"
      style={{ borderLeft: `3px solid ${alert.acknowledged ? "transparent" : severityBorder(alert.severity)}` }}
    >
      <div className="shrink-0 mt-0.5">{severityIcon(alert.severity)}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold leading-tight" style={{ color: "var(--text)", opacity: alert.acknowledged ? 0.6 : 1 }}>
          {alert.title}
        </p>
        <p className="text-[10px] mt-0.5 leading-tight" style={{ color: "var(--text-muted)" }}>
          {alert.message}
        </p>
        <p className="text-[9px] mt-1" style={{ color: "var(--text-muted)", opacity: 0.7 }}>
          {timeAgo(alert.detectedAt)}
        </p>
      </div>
      {!alert.acknowledged && (
        <button
          type="button"
          onClick={() => onAck(alert.id)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--text)]"
          aria-label={`Đánh dấu đã đọc: ${alert.title}`}
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
