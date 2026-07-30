"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowsClockwise, ChatCircleDots, FacebookLogo, Robot } from "@phosphor-icons/react";
import { DashboardMetric, DashboardStatusStrip } from "@/components/dashboard/Dashboard";
import { Button } from "@/components/ui/Button";
import type { InboxMessageData } from "@/lib/customer-inbox";
import { formatDateTime } from "@/lib/utils";

interface CustomerInboxViewProps {
  facebookPageId: string;
  view: "queue" | "conversation";
  initialMessages: InboxMessageData[];
  selectedMessage: InboxMessageData | null;
  canMutate: boolean;
  status?: string;
  q?: string;
}

export function CustomerInboxView({ facebookPageId, view, initialMessages, selectedMessage, canMutate, status, q }: CustomerInboxViewProps) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState(q ?? "");
  const filteredMessages = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("vi");
    return initialMessages.filter((message) => {
      const matchesQuery = !normalized || `${message.senderName} ${message.message} ${message.reply ?? ""}`.toLocaleLowerCase("vi").includes(normalized);
      const matchesStatus = status === "handled" ? message.isRead : status === "unhandled" ? !message.isRead : status === "replied" ? Boolean(message.reply) : true;
      return matchesQuery && matchesStatus;
    });
  }, [initialMessages, query, status]);

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
      if (action === "sync-fb") setFeedback(`Đã đồng bộ ${result.data.total} bản ghi, thêm ${result.data.newCount} tin mới.`);
      else if (action === "auto-reply") setFeedback("Đã lưu bản nháp trả lời AI.");
      else setFeedback("Đã gửi reply được lưu qua Messenger.");
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Không thể thực hiện thao tác");
    } finally {
      setPendingAction(null);
    }
  };

  const hrefFor = (nextView: "queue" | "conversation", messageId?: string) => {
    const params = new URLSearchParams({ view: nextView, scope: "current", pageId: facebookPageId });
    if (messageId) params.set("id", messageId);
    if (status) params.set("status", status);
    if (query.trim()) params.set("q", query.trim());
    return `/customers/inbox?${params.toString()}`;
  };

  const handled = initialMessages.filter((message) => message.isRead).length;
  const savedReplies = initialMessages.filter((message) => message.reply).length;

  return (
    <div className="space-y-5">
      <DashboardStatusStrip
        tone="info"
        title="Inbox đang hiển thị message records của một Facebook Page"
        detail="Dữ liệu hiện chưa có thread hội thoại đầy đủ. isRead chỉ là trạng thái xử lý legacy; reply được lưu không tự chứng minh external delivery."
        meta={`Tối đa 50 record gần nhất · ${initialMessages.length} record đang tải · chưa persist thời điểm sync thành công gần nhất`}
        action={{ href: "/system/settings?view=channels&scope=account", label: "Kiểm tra kết nối" }}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <DashboardMetric label="Records đang tải" value={initialMessages.length} detail="Page hiện tại" icon={ChatCircleDots} />
        <DashboardMetric label="Legacy đã xử lý" value={handled} detail="Không phải delivery receipt" tone="info" />
        <DashboardMetric label="Có reply được lưu" value={savedReplies} detail="Draft hoặc reply persisted" tone={savedReplies ? "success" : "warning"} />
      </div>

      {feedback ? <p className="rounded-md bg-[var(--accent-light)] p-3 text-xs text-[var(--accent)]" role="status">{feedback}</p> : null}
      {error ? <p className="rounded-md bg-[var(--rose-light)] p-3 text-xs text-[var(--rose)]" role="alert">{error}</p> : null}

      <section className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-card)] shadow-[var(--shadow-sm)]">
        <div className="flex flex-col gap-3 border-b border-[var(--border)] bg-[var(--bg-subtle)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="text-base font-extrabold">Hàng đợi hội thoại</h2><p className="mt-1 text-xs text-[var(--text-muted)]">Tìm trong 50 record đã server-load; filter không gọi provider hoặc tạo mutation.</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Tìm message record" placeholder="Tên hoặc nội dung..." className="min-h-11 min-w-0 rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-3 text-sm sm:w-64" />
            {canMutate ? <Button size="sm" variant="secondary" loading={pendingAction === "sync-fb"} onClick={() => runAction("sync-fb", {})}><ArrowsClockwise size={14} aria-hidden="true" /> Đồng bộ ngay</Button> : null}
          </div>
        </div>

        <div className="lg:grid lg:min-h-[34rem] lg:grid-cols-[minmax(17rem,0.78fr)_minmax(22rem,1.22fr)_minmax(15rem,0.62fr)]">
          <div className={`${view === "conversation" ? "hidden lg:block" : "block"} min-w-0 border-r-0 border-[var(--border)] lg:border-r`}>
            <MessageList messages={filteredMessages} detailHref={(id) => hrefFor("conversation", id)} selectedMessageId={selectedMessage?.id} />
          </div>
          <div className={`${view === "queue" ? "hidden lg:block" : "block"} min-w-0 border-r-0 border-[var(--border)] lg:border-r`}>
            <MessageDetail message={selectedMessage} backHref={hrefFor("queue")} canMutate={canMutate} pendingAction={pendingAction} onAutoReply={(messageId) => runAction("auto-reply", { messageId }, `${messageId}:auto-reply`)} onSend={(messageId) => runAction("send-fb-reply", { messageId }, `${messageId}:send-fb-reply`)} />
          </div>
          <div className={`${view === "queue" ? "hidden lg:block" : "block"} min-w-0`}>
            <MessageFacts message={selectedMessage} />
          </div>
        </div>
      </section>
    </div>
  );
}

function MessageList({ messages, detailHref, selectedMessageId }: { messages: InboxMessageData[]; detailHref: (messageId: string) => string; selectedMessageId?: string }) {
  return (
    <div>
      <div className="border-b border-[var(--border)] px-4 py-3"><h3 className="text-sm font-bold">Message records</h3><p className="mt-1 text-xs text-[var(--text-muted)]">{messages.length} record phù hợp</p></div>
      {messages.length ? <div className="divide-y divide-[var(--border)] lg:max-h-[31rem] lg:overflow-y-auto">{messages.map((message) => (
        <Link key={message.id} href={detailHref(message.id)} aria-current={selectedMessageId === message.id ? "page" : undefined} className={`block min-h-11 p-4 hover:bg-[var(--bg-subtle)] ${selectedMessageId === message.id ? "bg-[var(--accent-light)]" : "bg-[var(--bg-card)]"}`}>
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-bold">{message.senderName}</p><MessageSource message={message} /></div><p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-secondary)]">{message.message}</p></div><time className="shrink-0 text-[10px] text-[var(--text-muted)]">{formatDateTime(message.createdAt)}</time></div>
          <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-semibold text-[var(--text-muted)]"><span>{message.reply ? "Có reply được lưu" : "Chưa có reply"}</span><span>·</span><span>{message.isRead ? "Legacy: đã xử lý" : "Legacy: chưa đánh dấu"}</span></div>
        </Link>
      ))}</div> : <Empty message="Chưa có message record phù hợp cho Facebook Page này." />}
    </div>
  );
}

function MessageDetail({ message, backHref, canMutate, pendingAction, onAutoReply, onSend }: { message: InboxMessageData | null; backHref: string; canMutate: boolean; pendingAction: string | null; onAutoReply: (messageId: string) => void; onSend: (messageId: string) => void }) {
  if (!message) return <div className="flex min-h-72 items-center justify-center p-6 text-center"><div><ChatCircleDots size={28} className="mx-auto text-[var(--accent)]" aria-hidden="true" /><h3 className="mt-3 text-sm font-bold">Chọn một message record</h3><p className="mt-2 max-w-sm text-xs leading-5 text-[var(--text-muted)]">URL sẽ lưu ID bản ghi đang xem. Dữ liệu hiện chưa có thread hội thoại đầy đủ.</p></div></div>;
  const realMessage = !message.senderId.startsWith("sim_");
  return (
    <div className="p-4 sm:p-5">
      <Link href={backHref} className="mb-4 inline-flex min-h-11 items-center gap-2 text-xs font-bold text-[var(--accent)] lg:hidden"><ArrowLeft size={15} aria-hidden="true" /> Quay lại hàng đợi</Link>
      <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] pb-4"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-extrabold">{message.senderName}</h3><MessageSource message={message} /></div><p className="mt-1 text-xs text-[var(--text-muted)]">{formatDateTime(message.createdAt)}</p></div></div>
      <section className="mt-5"><p className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Tin khách gửi</p><p className="mt-2 break-words rounded-[12px] bg-[var(--bg-subtle)] p-4 text-sm leading-6">{message.message}</p></section>
      <section className="mt-5"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Reply được lưu</p>{message.isAutoReply ? <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--accent)]"><Robot size={12} aria-hidden="true" /> AI draft</span> : null}</div>{message.reply ? <p className="mt-2 break-words rounded-[12px] bg-[var(--accent-light)] p-4 text-sm leading-6">{message.reply}</p> : <p className="mt-2 rounded-[12px] border border-dashed border-[var(--border)] p-4 text-sm text-[var(--text-muted)]">Chưa có reply được lưu cho bản ghi này.</p>}</section>
      {canMutate ? <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">{!message.reply ? <Button loading={pendingAction === `${message.id}:auto-reply`} onClick={() => onAutoReply(message.id)}><Robot size={14} aria-hidden="true" /> AI soạn reply</Button> : null}{message.reply && realMessage && !message.isRead ? <Button loading={pendingAction === `${message.id}:send-fb-reply`} onClick={() => onSend(message.id)}><FacebookLogo size={14} aria-hidden="true" /> Gửi qua Messenger</Button> : null}{message.reply && realMessage && message.isRead ? <p className="text-xs leading-5 text-[var(--text-muted)]">Bản ghi đã được legacy workflow đánh dấu xử lý; nút gửi lại được ẩn để tránh gửi trùng.</p> : null}</div> : <p className="mt-5 border-t border-[var(--border)] pt-4 text-xs text-[var(--text-muted)]">Bạn có quyền xem nhưng không có quyền soạn, đồng bộ hoặc gửi reply.</p>}
    </div>
  );
}

function MessageFacts({ message }: { message: InboxMessageData | null }) {
  return <div className="p-4 sm:p-5"><h3 className="text-sm font-extrabold">Persisted facts</h3><p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">Không suy diễn Customer, Lead, assignee hoặc channel delivery.</p>{message ? <div className="mt-4"><Fact label="Sender ID" value={message.senderId} /><Fact label="Nguồn" value={message.senderId.startsWith("sim_") ? "Mô phỏng" : "Facebook record"} /><Fact label="Tạo lúc" value={formatDateTime(message.createdAt)} /><Fact label="Saved reply" value={message.reply ? "Có" : "Không"} /><Fact label="AI draft flag" value={message.isAutoReply ? "Có" : "Không"} /><Fact label="Legacy handling" value={message.isRead ? "Đã đánh dấu xử lý" : "Chưa đánh dấu"} /></div> : <p className="mt-6 text-xs leading-5 text-[var(--text-muted)]">Chọn một record để xem facts đã persist.</p>}</div>;
}

function Fact({ label, value }: { label: string; value: string }) { return <div className="border-b border-[var(--border)] py-3 last:border-0"><p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">{label}</p><p className="mt-1 break-words text-xs font-semibold leading-5">{value}</p></div>; }
function MessageSource({ message }: { message: InboxMessageData }) { return message.senderId.startsWith("sim_") ? <span className="rounded-full bg-[var(--bg-subtle)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-muted)]">Mô phỏng</span> : <span className="inline-flex items-center gap-1 rounded-full bg-[#1877F2]/10 px-2 py-0.5 text-[10px] font-semibold text-[#1877F2]"><FacebookLogo size={11} aria-hidden="true" /> Facebook</span>; }
function Empty({ message }: { message: string }) { return <p className="px-4 py-12 text-center text-sm leading-6 text-[var(--text-muted)]">{message}</p>; }
