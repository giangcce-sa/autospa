"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Flame, ArrowRight, Phone, ChatCircle } from "@phosphor-icons/react";

interface Lead {
  id: string;
  name: string;
  phone: string | null;
  score: number;
  lastContact: string | null;
  source: string;
  status: string;
}

function scoreColor(score: number) {
  if (score >= 80) return "var(--danger)";
  if (score >= 60) return "var(--warning)";
  return "var(--accent)";
}

function timeAgo(ts: string | null): string {
  if (!ts) return "—";
  const ms = Date.now() - new Date(ts).getTime();
  const h = Math.floor(ms / 3600000);
  if (h < 1) return "vừa xong";
  if (h < 24) return `${h}h trước`;
  return `${Math.floor(h / 24)}d trước`;
}

export function HotLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/sale")
      .then((r) => r.json())
      .then((res) => {
        const all: Lead[] = res.data ?? [];
        const hot = all
          .filter((l) => l.score >= 60 && l.status !== "closed")
          .sort((a, b) => b.score - a.score)
          .slice(0, 4);
        setLeads(hot);
      })
      .catch(() => setLeads([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>;
  }

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <Flame size={24} className="mb-1 opacity-20" style={{ color: "var(--text-muted)" }} weight="fill" />
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Chưa có lead nóng</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {leads.map((lead, idx) => {
        const color = scoreColor(lead.score);
        const initials = lead.name.split(" ").slice(-2).map((w: string) => w[0]).join("").toUpperCase();
        return (
          <div
            key={lead.id}
            className="rounded-xl px-3 py-2.5 flex items-center gap-3 transition-all hover:-translate-y-0.5 hover:shadow-md"
            style={{
              background: `linear-gradient(135deg, var(--bg-card) 0%, ${color}06 100%)`,
              border: `1px solid ${color}33`,
              animationDelay: `${idx * 60}ms`,
            }}
          >
            {/* Avatar + score ring */}
            <div className="relative shrink-0">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                style={{
                  background: `linear-gradient(135deg, ${color}33, ${color}18)`,
                  color,
                  border: `2px solid ${color}`,
                  boxShadow: `0 0 8px ${color}30`,
                }}
              >
                {initials || lead.score}
              </div>
              {lead.score >= 80 && (
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 status-dot-warning" style={{ background: color, borderColor: "var(--bg-card)" }} />
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: "var(--text)" }}>{lead.name}</p>
              <div className="flex items-center gap-2 text-[10px]" style={{ color: "var(--text-muted)" }}>
                <span>{lead.source}</span>
                <span>·</span>
                <span>{timeAgo(lead.lastContact)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-1 shrink-0">
              {lead.phone && (
                <a
                  href={`tel:${lead.phone}`}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-opacity hover:opacity-80"
                  style={{ background: "var(--accent-light)" }}
                >
                  <Phone size={11} weight="fill" style={{ color: "var(--accent)" }} />
                </a>
              )}
              <Link
                href="/inbox"
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-opacity hover:opacity-80"
                style={{ background: "var(--blue-light)" }}
              >
                <ChatCircle size={11} weight="fill" style={{ color: "var(--blue)" }} />
              </Link>
            </div>
          </div>
        );
      })}

      <Link
        href="/sale"
        className="flex items-center justify-center gap-1 pt-1 text-[10px] hover:opacity-70 transition-opacity"
        style={{ color: "var(--text-muted)" }}
      >
        Xem tất cả leads <ArrowRight size={9} />
      </Link>
    </div>
  );
}
