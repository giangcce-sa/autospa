"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowsClockwise, FacebookLogo, Robot } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { InboxMessageData } from "@/lib/customer-inbox";
import { formatDateTime } from "@/lib/utils";

interface CustomerInboxViewProps {
  facebookPageId: string;
  view: "queue" | "conversation";
  initialMessages: InboxMessageData[];
  selectedMessage: InboxMessageData | null;
  canMutate: boolean;
}

export function CustomerInboxView({
  facebookPageId,
  view,
  initialMessages,
  selectedMessage,
  canMutate,
}: CustomerInboxViewProps) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runAction = async (action: string, body: Record<string, unknown>, actionKey = action) => {
    setPendingAction(actionKey);
    setError(null);
    setFeedback(null);
    try {
      const response = await fetch("/api/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, facebookPageId, ...body }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Không thể thực hiện thao tác");
      if (action === "sync-fb") {
        setFeedback(`Đã đồng bộ ${result.data.total} bản ghi, thêm ${result.data.newCount} tin mới.`);
      } else if (action === "auto-reply") {
        setFeedback("Đã lưu bản nháp trả lời AI.");
      } else {
        setFeedback("Đã gửi reply được lưu qua Messenger.");
      }
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Không thể thực hiện thao tác");
    } finally {
      setPendingAction(null);
    }
  };

  const detailHref = (messageId: string) => {
    const params = new URLSearchParams({
      view: "conversation",
      scope: "current",
      pageId: facebookPageId,
      id: messageId,
    });
    return `/customers/inbox?${params.toString()}`;
  };

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] p-4">
        <div>
          <p className="text-sm font-semibold text-[var(--text)]">Tin nhắn theo Facebook Page</p>
          <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
            Hiển thị tối đa 50 tin gần nhất. Hệ thống chưa lưu thời điểm sync thành công gần nhất.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/system/settings?view=channels&scope=account" className="inline-flex min-h-9 items-center rounded-md px-3 text-xs font-semibold text-[var(--accent)]">
            Kiểm tra kết nối
          </Link>
          {canMutate ? (
            <Button
              size="sm"
              variant="secondary"
              loading={pendingAction === "sync-fb"}
              onClick={() => runAction("sync-fb", {})}
            >
              <ArrowsClockwise size={14} aria-hidden="true" /> Đồng bộ ngay
            </Button>
          ) : null}
        </div>
      </section>

      {feedback ? <p className="rounded-md bg-[var(--accent-light)] p-3 text-xs text-[var(--accent)]" role="status">{feedback}</p> : null}
      {error ? <p className="rounded-md bg-[var(--rose-light)] p-3 text-xs text-[var(--rose)]" role="alert">{error}</p> : null}

      <div className={view === "conversation" ? "grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]" : ""}>
        <MessageList messages={initialMessages} detailHref={detailHref} selectedMessageId={selectedMessage?.id} />
        {view === "conversation" ? (
          <MessageDetail
            message={selectedMessage}
            canMutate={canMutate}
            pendingAction={pendingAction}
            onAutoReply={(messageId) => runAction("auto-reply", { messageId }, `${messageId}:auto-reply`)}
            onSend={(messageId) => runAction("send-fb-reply", { messageId }, `${messageId}:send-fb-reply`)}
          />
        ) : null}
      </div>
    </div>
  );
}

function MessageList({
  messages,
  detailHref,
  selectedMessageId,
}: {
  messages: InboxMessageData[];
  detailHref: (messageId: string) => string;
  selectedMessageId?: string;
}) {
  return (
    <Card padding="none" className="overflow-hidden">
      <div className="border-b border-[var(--border)] px-4 py-3">
        <h2 className="text-sm font-bold text-[var(--text)]">Tin nhắn gần đây</h2>
        <p className="mt-1 text-xs text-[var(--text-muted)]">{messages.length} bản ghi đang hiển thị</p>
      </div>
      {messages.length ? (
        <div className="divide-y divide-[var(--border)]">
          {messages.map((message) => (
            <Link
              key={message.id}
              href={detailHref(message.id)}
              aria-current={selectedMessageId === message.id ? "page" : undefined}
              className={`block p-4 hover:bg-[var(--bg-subtle)] ${selectedMessageId === message.id ? "bg-[var(--accent-light)]" : "bg-[var(--bg-card)]"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-[var(--text)]">{message.senderName}</p>
                    <MessageSource message={message} />
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-secondary)]">{message.message}</p>
                </div>
                <time className="shrink-0 text-[10px] text-[var(--text-muted)]">{formatDateTime(message.createdAt)}</time>
              </div>
              <p className="mt-2 text-[10px] font-semibold text-[var(--text-muted)]">
                {message.reply ? "Có reply được lưu" : "Chưa có reply được lưu"}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <p className="px-4 py-12 text-center text-sm text-[var(--text-muted)]">Chưa có tin nhắn cho Facebook Page này.</p>
      )}
    </Card>
  );
}

function MessageDetail({
  message,
  canMutate,
  pendingAction,
  onAutoReply,
  onSend,
}: {
  message: InboxMessageData | null;
  canMutate: boolean;
  pendingAction: string | null;
  onAutoReply: (messageId: string) => void;
  onSend: (messageId: string) => void;
}) {
  if (!message) {
    return (
      <Card className="flex min-h-64 items-center justify-center text-center">
        <div>
          <h2 className="text-sm font-bold text-[var(--text)]">Chọn một tin nhắn</h2>
          <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">URL sẽ lưu ID bản ghi đang xem. Dữ liệu hiện chưa có thread hội thoại đầy đủ.</p>
        </div>
      </Card>
    );
  }

  const realMessage = !message.senderId.startsWith("sim_");

  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold text-[var(--text)]">{message.senderName}</h2>
            <MessageSource message={message} />
          </div>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{formatDateTime(message.createdAt)}</p>
        </div>
      </div>

      <section>
        <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Tin khách gửi</p>
        <p className="mt-2 rounded-lg bg-[var(--bg-subtle)] p-4 text-sm leading-6 text-[var(--text)]">{message.message}</p>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Reply được lưu</p>
          {message.isAutoReply ? <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--accent)]"><Robot size={12} aria-hidden="true" /> AI draft</span> : null}
        </div>
        {message.reply ? (
          <p className="mt-2 rounded-lg bg-[var(--accent-light)] p-4 text-sm leading-6 text-[var(--text)]">{message.reply}</p>
        ) : (
          <p className="mt-2 rounded-lg border border-dashed border-[var(--border)] p-4 text-sm text-[var(--text-muted)]">Chưa có reply được lưu cho bản ghi này.</p>
        )}
      </section>

      {canMutate ? (
        <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
          {!message.reply ? (
            <Button loading={pendingAction === `${message.id}:auto-reply`} onClick={() => onAutoReply(message.id)}>
              <Robot size={14} aria-hidden="true" /> AI soạn reply
            </Button>
          ) : null}
          {message.reply && realMessage && !message.isRead ? (
            <Button loading={pendingAction === `${message.id}:send-fb-reply`} onClick={() => onSend(message.id)}>
              <FacebookLogo size={14} aria-hidden="true" /> Gửi qua Messenger
            </Button>
          ) : null}
          {message.reply && realMessage && message.isRead ? (
            <p className="text-xs leading-5 text-[var(--text-muted)]">Bản ghi đã được legacy workflow đánh dấu xử lý; nút gửi lại được ẩn để tránh gửi trùng.</p>
          ) : null}
        </div>
      ) : (
        <p className="border-t border-[var(--border)] pt-4 text-xs text-[var(--text-muted)]">Bạn có quyền xem nhưng không có quyền soạn, đồng bộ hoặc gửi reply.</p>
      )}
    </Card>
  );
}

function MessageSource({ message }: { message: InboxMessageData }) {
  return message.senderId.startsWith("sim_") ? (
    <span className="rounded-full bg-[var(--bg-subtle)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-muted)]">Mô phỏng</span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#1877F2]/10 px-2 py-0.5 text-[10px] font-semibold text-[#1877F2]">
      <FacebookLogo size={11} aria-hidden="true" /> Facebook
    </span>
  );
}
