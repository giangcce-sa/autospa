"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Bell, X, Checks, WarningCircle, Info, Warning, Fire } from "@phosphor-icons/react";

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
  const dropRef = useRef<HTMLDivElement>(null);

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

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

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
    <div className="relative" ref={dropRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-1.5 rounded-lg transition-opacity hover:opacity-70"
        style={{ color: "var(--text-muted)" }}
        aria-label="Thông báo"
      >
        <Bell size={18} weight={unack > 0 ? "fill" : "regular"} style={{ color: unack > 0 ? "var(--warning)" : undefined }} />
        {unack > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full flex items-center justify-center text-[9px] font-bold px-1"
            style={{ background: "var(--danger)", color: "white" }}
          >
            {unack > 99 ? "99+" : unack}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-80 rounded-2xl shadow-xl overflow-hidden z-50"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)",
            animation: "slide-in-up 0.18s cubic-bezier(0.4,0,0.2,1) both",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2">
              <Bell size={14} weight="fill" style={{ color: "var(--warning)" }} />
              <p className="text-xs font-bold" style={{ color: "var(--text)" }}>Thông báo</p>
              {unack > 0 && (
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: "var(--danger-light)", color: "var(--danger)" }}>
                  {unack} mới
                </span>
              )}
            </div>
            {unack > 0 && (
              <button
                onClick={acknowledgeAll}
                disabled={ackingAll}
                className="flex items-center gap-1 text-[10px] transition-opacity hover:opacity-70 disabled:opacity-40"
                style={{ color: "var(--accent)" }}
              >
                <Checks size={11} /> Đánh dấu tất cả
              </button>
            )}
          </div>

          {/* Body */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="space-y-2 p-3">
                {[1,2,3].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}
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
                    <p className="px-4 pt-3 pb-1 text-[9px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Chưa đọc</p>
                    {unread.map((a) => (
                      <AlertRow key={a.id} alert={a} onAck={acknowledge} />
                    ))}
                  </div>
                )}
                {read.length > 0 && (
                  <div>
                    <p className="px-4 pt-3 pb-1 text-[9px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Đã đọc</p>
                    {read.slice(0, 10).map((a) => (
                      <AlertRow key={a.id} alert={a} onAck={acknowledge} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t text-center" style={{ borderColor: "var(--border)" }}>
            <a href="/listening" className="text-[10px] transition-opacity hover:opacity-70" style={{ color: "var(--text-muted)" }}>
              Xem tất cả trong Listening →
            </a>
          </div>
        </div>
      )}
    </div>
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
          onClick={() => onAck(alert.id)}
          className="shrink-0 mt-0.5 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--bg-subtle)]"
          style={{ color: "var(--text-muted)" }}
          title="Đánh dấu đã đọc"
        >
          <X size={10} />
        </button>
      )}
    </div>
  );
}
