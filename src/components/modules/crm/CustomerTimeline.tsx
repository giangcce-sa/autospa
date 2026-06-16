"use client";

import { Note, CalendarBlank, ChatCircle, Heart, Envelope } from "@phosphor-icons/react";

interface TimelineEvent {
  id: string;
  type: "note" | "appointment" | "care" | "message";
  title: string;
  sub?: string;
  date: string;
  status?: string;
}

interface Props {
  notes: { id: string; content: string; type: string; createdAt: string }[];
  appointments: { id: string; service?: string | null; preferredAt?: string | null; status: string; createdAt?: string }[];
  careMessages: { id: string; type: string; content: string; status: string; sentAt?: string | null; createdAt: string }[];
  messages: { id: string; message: string; reply?: string | null; isAutoReply: boolean; createdAt: string }[];
}

const META: Record<TimelineEvent["type"], { icon: React.ElementType; color: string; label: string }> = {
  note: { icon: Note, color: "var(--accent)", label: "Ghi chú" },
  appointment: { icon: CalendarBlank, color: "var(--blue)", label: "Lịch hẹn" },
  care: { icon: Heart, color: "var(--rose)", label: "Chăm sóc" },
  message: { icon: ChatCircle, color: "var(--amber)", label: "Tin nhắn" },
};

function statusColor(s?: string) {
  if (!s) return "var(--text-muted)";
  if (s === "confirmed" || s === "sent" || s === "done") return "var(--success)";
  if (s === "cancelled" || s === "failed") return "var(--danger)";
  return "var(--text-muted)";
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function CustomerTimeline({ notes, appointments, careMessages, messages }: Props) {
  const events: TimelineEvent[] = [
    ...notes.map((n) => ({
      id: n.id, type: "note" as const,
      title: n.content.length > 80 ? n.content.slice(0, 80) + "…" : n.content,
      date: n.createdAt,
    })),
    ...appointments.map((a) => ({
      id: a.id, type: "appointment" as const,
      title: a.service || "Lịch hẹn",
      sub: a.preferredAt || undefined,
      date: a.createdAt || a.preferredAt || new Date().toISOString(),
      status: a.status,
    })),
    ...careMessages.map((c) => ({
      id: c.id, type: "care" as const,
      title: c.type.replace(/_/g, " "),
      sub: c.content.length > 60 ? c.content.slice(0, 60) + "…" : c.content,
      date: c.sentAt || c.createdAt,
      status: c.status,
    })),
    ...messages.map((m) => ({
      id: m.id, type: "message" as const,
      title: m.message.length > 60 ? m.message.slice(0, 60) + "…" : m.message,
      sub: m.reply ? `Trả lời: ${m.reply.slice(0, 40)}…` : undefined,
      date: m.createdAt,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Envelope size={28} className="mb-2 opacity-20" style={{ color: "var(--text-muted)" }} />
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Chưa có lịch sử tương tác</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div
        className="absolute left-[15px] top-2 bottom-2 w-px"
        style={{ background: "var(--border)" }}
      />

      <div className="space-y-3">
        {events.map((ev) => {
          const m = META[ev.type];
          const Icon = m.icon;
          return (
            <div key={ev.id} className="flex gap-3 items-start">
              {/* Node */}
              <div
                className="relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{ background: m.color + "18", border: `1.5px solid ${m.color}44` }}
              >
                <Icon size={13} weight="fill" style={{ color: m.color }} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium leading-snug" style={{ color: "var(--text)" }}>{ev.title}</p>
                    {ev.sub && (
                      <p className="text-[10px] mt-0.5 leading-snug" style={{ color: "var(--text-muted)" }}>{ev.sub}</p>
                    )}
                  </div>
                  {ev.status && (
                    <span className="text-[9px] shrink-0 font-semibold" style={{ color: statusColor(ev.status) }}>
                      {ev.status}
                    </span>
                  )}
                </div>
                <p className="text-[9px] mt-1" style={{ color: "var(--text-muted)", opacity: 0.7 }}>
                  {m.label} · {fmt(ev.date)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
