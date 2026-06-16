"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarBlank, Flame, ChatCircleDots, ArrowRight } from "@phosphor-icons/react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { SkeletonList } from "@/components/ui/Skeleton";
import { formatDateTime, truncate } from "@/lib/utils";

interface ScheduledPost {
  id: string;
  caption: string;
  scheduledAt: string;
  platform: string;
}
interface HotLead {
  id: string;
  name: string;
  service: string | null;
  source: string;
}
interface UnreadMsg {
  id: string;
  senderName: string;
  message: string;
  createdAt: string;
}

interface QueueData {
  scheduledToday: ScheduledPost[];
  hotLeads: HotLead[];
  unreadMessages: UnreadMsg[];
}

export function TodayQueue() {
  const [data, setData] = useState<QueueData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Reuse existing dashboard API + content/list + inbox + sale
    Promise.all([
      fetch("/api/content/list?status=scheduled").then((r) => r.json()),
      fetch("/api/sale").then((r) => r.json()).catch(() => ({ data: { leads: [] } })),
      fetch("/api/inbox").then((r) => r.json()).catch(() => ({ data: { messages: [] } })),
    ])
      .then(([schedRes, leadsRes, inboxRes]) => {
        const now = new Date();
        const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);

        const scheduledToday = (schedRes.data ?? [])
          .filter((p: ScheduledPost) => {
            if (!p.scheduledAt) return false;
            const d = new Date(p.scheduledAt);
            return d >= now && d <= todayEnd;
          })
          .slice(0, 5);

        const hotLeads = ((leadsRes.data?.leads ?? leadsRes.data ?? []) as Array<{ id: string; name: string; service: string | null; source: string; stage: string }>)
          .filter((l) => l.stage === "hot")
          .slice(0, 5);

        const unreadMessages = ((inboxRes.data?.messages ?? inboxRes.data ?? []) as Array<{ id: string; senderName: string; message: string; createdAt: string; isRead?: boolean }>)
          .filter((m) => !m.isRead)
          .slice(0, 5);

        setData({ scheduledToday, hotLeads, unreadMessages });
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <SkeletonList rows={3} />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Scheduled posts today */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CalendarBlank size={14} style={{ color: "var(--accent)" }} weight="fill" />
            <CardTitle>Lên lịch hôm nay</CardTitle>
          </div>
          <Link href="/publish" className="text-[11px] flex items-center gap-0.5 transition-opacity hover:opacity-80" style={{ color: "var(--text-muted)" }}>
            Tất cả <ArrowRight size={10} />
          </Link>
        </CardHeader>
        {data?.scheduledToday.length === 0 ? (
          <p className="text-xs py-4 text-center" style={{ color: "var(--text-muted)" }}>
            Không có bài nào lên lịch hôm nay
          </p>
        ) : (
          <div className="space-y-2">
            {data?.scheduledToday.map((p) => (
              <Link
                key={p.id}
                href={`/publish?postId=${p.id}`}
                className="block p-2 rounded-lg transition-colors hover:opacity-80"
                style={{ background: "var(--bg-subtle)" }}
              >
                <p className="text-xs leading-snug" style={{ color: "var(--text)" }}>{truncate(p.caption, 70)}</p>
                <p className="text-[10px] mt-0.5 tabular-nums" style={{ color: "var(--text-muted)" }}>
                  {formatDateTime(p.scheduledAt)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* Hot leads */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Flame size={14} style={{ color: "var(--rose)" }} weight="fill" />
            <CardTitle>Lead nóng</CardTitle>
          </div>
          <Link href="/sale" className="text-[11px] flex items-center gap-0.5 transition-opacity hover:opacity-80" style={{ color: "var(--text-muted)" }}>
            Tất cả <ArrowRight size={10} />
          </Link>
        </CardHeader>
        {data?.hotLeads.length === 0 ? (
          <p className="text-xs py-4 text-center" style={{ color: "var(--text-muted)" }}>
            Chưa có lead nóng
          </p>
        ) : (
          <div className="space-y-2">
            {data?.hotLeads.map((l) => (
              <Link
                key={l.id}
                href={`/sale?leadId=${l.id}`}
                className="block p-2 rounded-lg transition-colors hover:opacity-80"
                style={{ background: "var(--bg-subtle)" }}
              >
                <p className="text-xs font-medium" style={{ color: "var(--text)" }}>{l.name}</p>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {l.service ?? "Chưa rõ DV"} · {l.source}
                </p>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* Unread inbox */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ChatCircleDots size={14} style={{ color: "var(--blue)" }} weight="fill" />
            <CardTitle>Tin nhắn mới</CardTitle>
          </div>
          <Link href="/inbox" className="text-[11px] flex items-center gap-0.5 transition-opacity hover:opacity-80" style={{ color: "var(--text-muted)" }}>
            Tất cả <ArrowRight size={10} />
          </Link>
        </CardHeader>
        {data?.unreadMessages.length === 0 ? (
          <p className="text-xs py-4 text-center" style={{ color: "var(--text-muted)" }}>
            Inbox sạch — không có tin chưa đọc
          </p>
        ) : (
          <div className="space-y-2">
            {data?.unreadMessages.map((m) => (
              <Link
                key={m.id}
                href="/inbox"
                className="block p-2 rounded-lg transition-colors hover:opacity-80"
                style={{ background: "var(--bg-subtle)" }}
              >
                <p className="text-xs font-medium" style={{ color: "var(--text)" }}>{m.senderName}</p>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{truncate(m.message, 60)}</p>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
