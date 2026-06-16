"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, X, PencilSimple, UserPlus, CalendarPlus, Sparkle, PaperPlaneTilt,
} from "@phosphor-icons/react";

interface Action {
  icon: React.ElementType;
  label: string;
  color: string;
  onClick: () => void;
}

export function QuickCompose() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [leadName, setLeadName] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadSource, setLeadSource] = useState("manual");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowLeadForm(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); setShowLeadForm(false); } };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const saveLead = async () => {
    if (!leadName.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/sale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", name: leadName.trim(), phone: leadPhone.trim() || null, source: leadSource }),
      });
      setSaved(true);
      setTimeout(() => {
        setLeadName(""); setLeadPhone(""); setLeadSource("manual");
        setShowLeadForm(false); setOpen(false); setSaved(false);
      }, 1000);
    } finally { setSaving(false); }
  };

  const actions: Action[] = [
    {
      icon: PencilSimple,
      label: "Viết bài AI",
      color: "var(--accent)",
      onClick: () => { router.push("/content"); setOpen(false); },
    },
    {
      icon: PaperPlaneTilt,
      label: "Lên lịch đăng",
      color: "var(--blue)",
      onClick: () => { router.push("/publish"); setOpen(false); },
    },
    {
      icon: UserPlus,
      label: "Nhập lead",
      color: "var(--danger)",
      onClick: () => setShowLeadForm(true),
    },
    {
      icon: CalendarPlus,
      label: "Đặt lịch khách",
      color: "var(--amber)",
      onClick: () => { router.push("/appointments"); setOpen(false); },
    },
    {
      icon: Sparkle,
      label: "Tạo ảnh AI",
      color: "var(--premium)",
      onClick: () => { router.push("/images"); setOpen(false); },
    },
  ];

  return (
    <div ref={ref} className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 flex flex-col items-end gap-2">

      {/* Action items — radiate upward when open */}
      {open && !showLeadForm && (
        <div className="flex flex-col-reverse gap-2 mb-1">
          {actions.map((action, i) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                onClick={action.onClick}
                className="flex items-center gap-2.5 self-end rounded-2xl px-3.5 py-2 shadow-lg transition-all hover:scale-105 active:scale-95"
                style={{
                  background: "var(--bg-card)",
                  border: `1px solid ${action.color}44`,
                  animation: `slide-in-up 0.2s cubic-bezier(0.34,1.56,0.64,1) ${i * 40}ms both`,
                  boxShadow: `0 4px 16px rgba(0,0,0,0.12), 0 0 0 1px ${action.color}22`,
                }}
              >
                <span className="text-xs font-medium" style={{ color: "var(--text)" }}>{action.label}</span>
                <div
                  className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: action.color + "20" }}
                >
                  <Icon size={14} weight="fill" style={{ color: action.color }} />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Inline lead form */}
      {open && showLeadForm && (
        <div
          className="rounded-2xl p-4 w-64 shadow-xl mb-1"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
            animation: "slide-in-up 0.2s cubic-bezier(0.4,0,0.2,1) both",
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold" style={{ color: "var(--text)" }}>Nhập lead nhanh</p>
            <button onClick={() => setShowLeadForm(false)} style={{ color: "var(--text-muted)" }}>
              <X size={13} />
            </button>
          </div>
          <div className="space-y-2">
            <input
              autoFocus
              value={leadName}
              onChange={(e) => setLeadName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveLead()}
              placeholder="Tên khách *"
              className="w-full rounded-lg px-3 py-2 text-xs outline-none"
              style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text)" }}
            />
            <input
              value={leadPhone}
              onChange={(e) => setLeadPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveLead()}
              placeholder="Số điện thoại"
              className="w-full rounded-lg px-3 py-2 text-xs outline-none"
              style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text)" }}
            />
            <select
              value={leadSource}
              onChange={(e) => setLeadSource(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-xs outline-none"
              style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text)" }}
            >
              <option value="manual">Nhập tay</option>
              <option value="facebook">Facebook</option>
              <option value="zalo">Zalo</option>
              <option value="referral">Giới thiệu</option>
              <option value="ads">Quảng cáo</option>
            </select>
            <button
              onClick={saveLead}
              disabled={!leadName.trim() || saving}
              className="w-full rounded-lg py-2 text-xs font-semibold transition-all disabled:opacity-40"
              style={{ background: saved ? "var(--success)" : "var(--accent)", color: "white" }}
            >
              {saved ? "Đã lưu ✓" : saving ? "Đang lưu..." : "Lưu lead"}
            </button>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => { setOpen((v) => !v); setShowLeadForm(false); }}
        className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl transition-all hover:scale-105 active:scale-95"
        style={{
          background: open
            ? "var(--bg-subtle)"
            : "linear-gradient(135deg, var(--accent) 0%, var(--accent-hover, var(--accent)) 100%)",
          border: open ? "1px solid var(--border)" : "none",
          boxShadow: open ? "none" : "0 4px 20px color-mix(in srgb, var(--accent) 50%, transparent), 0 2px 8px rgba(0,0,0,0.12)",
        }}
      >
        <div style={{ transform: open ? "rotate(45deg)" : "rotate(0deg)", transition: "transform 0.2s cubic-bezier(0.34,1.56,0.64,1)" }}>
          <Plus size={20} weight="bold" style={{ color: open ? "var(--text-muted)" : "white" }} />
        </div>
      </button>
    </div>
  );
}
