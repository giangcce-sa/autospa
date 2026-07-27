"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarBlank, CaretDown, CaretUp, Sparkle, Stack, Trash } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { useActivePage } from "@/contexts/ActivePageContext";
import type { BulkPlanData } from "@/lib/bulk-plans";
import { formatDate } from "@/lib/utils";

const now = new Date();
const months = Array.from({ length: 12 }, (_, index) => ({ value: index + 1, label: `Tháng ${index + 1}` }));
const years = [now.getFullYear(), now.getFullYear() + 1];

export function BulkGenerator({
  facebookPageId: providedPageId,
  canMutate = true,
  initialPlans,
}: {
  facebookPageId?: string;
  canMutate?: boolean;
  initialPlans?: BulkPlanData[];
} = {}) {
  const { selectedPageId } = useActivePage();
  const facebookPageId = providedPageId ?? selectedPageId ?? undefined;
  const [plans, setPlans] = useState(initialPlans ?? []);
  const [form, setForm] = useState({
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    postsPerWeek: 3,
    tone: "friendly" as "friendly" | "professional" | "luxury",
  });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(initialPlans?.[0]?.id ?? null);

  const load = useCallback(async () => {
    if (!facebookPageId) {
      setPlans([]);
      return;
    }
    setRefreshing(true);
    setError("");
    try {
      const response = await fetch(`/api/bulk?facebookPageId=${encodeURIComponent(facebookPageId)}`);
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error ?? "Không thể tải kế hoạch");
      setPlans(payload.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tải kế hoạch");
    } finally {
      setRefreshing(false);
    }
  }, [facebookPageId]);

  useEffect(() => {
    if (initialPlans !== undefined && providedPageId) {
      setPlans(initialPlans);
      return;
    }
    load();
  }, [initialPlans, load, providedPageId]);

  const handleGenerate = async () => {
    if (!facebookPageId || !canMutate) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, postTypes: ["service", "tip", "promotion"], facebookPageId }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error ?? "Không tạo được kế hoạch");
      setExpanded(payload.data.id);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không tạo được kế hoạch");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!canMutate || !facebookPageId || !window.confirm("Xóa kế hoạch này và tất cả bài viết?")) return;
    setDeletingId(id);
    setError("");
    try {
      const response = await fetch("/api/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error ?? "Không xóa được kế hoạch");
      setPlans((current) => current.filter((plan) => plan.id !== id));
      if (expanded === id) setExpanded(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không xóa được kế hoạch");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {canMutate ? (
        <section className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-sm)]">
          <div className="flex items-start gap-3">
            <span className="chip-tone flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--purple-light)] text-[var(--purple)]">
              <Sparkle size={17} weight="fill" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-[16px] font-extrabold tracking-tight">Tạo kế hoạch nội dung theo tháng</h2>
              <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                AI dùng dịch vụ và văn phong của Trang hiện tại để tạo các bài nháp. Mỗi bài được lưu đúng Page và qua kiểm tra chất lượng trước khi sử dụng.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select label="Tháng" value={form.month} onChange={(event) => setForm({ ...form, month: Number(event.target.value) })}>
              {months.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}
            </Select>
            <Select label="Năm" value={form.year} onChange={(event) => setForm({ ...form, year: Number(event.target.value) })}>
              {years.map((year) => <option key={year} value={year}>{year}</option>)}
            </Select>
            <Select label="Bài mỗi tuần" value={form.postsPerWeek} onChange={(event) => setForm({ ...form, postsPerWeek: Number(event.target.value) })}>
              {[2, 3, 4, 5, 7].map((count) => <option key={count} value={count}>{count} bài</option>)}
            </Select>
            <Select
              label="Giọng văn"
              value={form.tone}
              onChange={(event) => setForm({ ...form, tone: event.target.value as typeof form.tone })}
            >
              <option value="friendly">Thân thiện</option>
              <option value="professional">Chuyên nghiệp</option>
              <option value="luxury">Sang trọng</option>
            </Select>
          </div>
          <Button onClick={handleGenerate} loading={loading} disabled={!facebookPageId} className="mt-4 w-full">
            <Sparkle size={14} weight="fill" /> Tạo kế hoạch tháng {form.month}/{form.year}
          </Button>
        </section>
      ) : (
        <section className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-card)] p-4 text-[13px] text-[var(--text-secondary)]">
          Bạn xem được các kế hoạch của Trang này, nhưng chỉ chủ sở hữu mới có thể tạo hoặc xóa kế hoạch.
        </section>
      )}

      {error && (
        <p role="alert" className="rounded-[9px] bg-[var(--danger-light)] px-3 py-2 text-[12.5px] font-semibold text-[var(--danger)]">
          {error}
        </p>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-[15px] font-bold">
            <Stack size={16} weight="bold" className="text-[var(--accent)]" aria-hidden="true" />
            Kế hoạch đã lưu
            <span className="rounded-[5px] bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-[var(--text-secondary)]">{plans.length}</span>
          </h2>
          <button
            type="button"
            onClick={load}
            disabled={refreshing || !facebookPageId}
            className="min-h-10 rounded-[8px] border border-[var(--border-strong)] px-3 text-[12px] font-semibold text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40"
          >
            {refreshing ? "Đang tải…" : "Làm mới"}
          </button>
        </div>

        {plans.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-card)] py-14 text-center">
            <Stack size={30} className="text-[var(--text-muted)]" aria-hidden="true" />
            <p className="text-[13.5px] font-semibold">Chưa có kế hoạch nào</p>
            <p className="max-w-sm text-[12.5px] text-[var(--text-muted)]">
              {canMutate ? "Chọn tháng và nhấn tạo kế hoạch để bắt đầu." : "Chủ sở hữu chưa tạo kế hoạch cho Trang này."}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {plans.map((plan) => {
              const published = plan.posts.filter((post) => post.status === "published").length;
              const scheduled = plan.posts.filter((post) => post.status === "scheduled").length;
              const draft = plan.posts.filter((post) => post.status === "draft").length;
              const open = expanded === plan.id;
              return (
                <li key={plan.id} className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-sm)]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-[14.5px] font-extrabold tracking-tight">{plan.name}</h3>
                      <p className="mt-1 text-[11.5px] text-[var(--text-muted)]">Tạo {formatDate(plan.createdAt)} · {plan.posts.length} bài</p>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-bold">
                        {published > 0 && <StatusChip label={`${published} đã đăng`} tone="green" />}
                        {scheduled > 0 && <StatusChip label={`${scheduled} lên lịch`} tone="blue" />}
                        {draft > 0 && <StatusChip label={`${draft} nháp`} tone="muted" />}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setExpanded(open ? null : plan.id)}
                        aria-expanded={open}
                        className="flex min-h-10 items-center gap-1.5 rounded-[8px] border border-[var(--border-strong)] px-3 text-[12px] font-semibold text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                      >
                        {open ? <CaretUp size={13} aria-hidden="true" /> : <CaretDown size={13} aria-hidden="true" />}
                        {open ? "Thu gọn" : "Xem bài"}
                      </button>
                      {canMutate && (
                        <button
                          type="button"
                          onClick={() => handleDelete(plan.id)}
                          disabled={deletingId === plan.id}
                          aria-label={`Xóa ${plan.name}`}
                          className="flex h-10 w-10 items-center justify-center rounded-[8px] text-[var(--text-muted)] hover:bg-[var(--danger-light)] hover:text-[var(--danger)] disabled:opacity-40"
                        >
                          <Trash size={14} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>

                  {open && (
                    <ul className="mt-4 space-y-2 border-t border-[var(--border)] pt-3">
                      {plan.posts.map((post) => (
                        <li key={post.id} className="flex flex-wrap items-start gap-3 rounded-[9px] bg-[var(--bg-subtle)] p-3">
                          <span className="mt-0.5 shrink-0"><StatusChip label={post.status === "published" ? "Đã đăng" : post.status === "scheduled" ? "Đã lên lịch" : "Nháp"} tone={post.status === "published" ? "green" : post.status === "scheduled" ? "blue" : "muted"} /></span>
                          <p className="min-w-0 flex-1 line-clamp-3 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">{post.caption}</p>
                          <div className="flex shrink-0 items-center gap-2">
                            {post.scheduledAt && (
                              <span className="flex items-center gap-1 text-[10.5px] text-[var(--text-muted)]">
                                <CalendarBlank size={11} aria-hidden="true" />{formatDate(post.scheduledAt)}
                              </span>
                            )}
                            {facebookPageId && (
                              <Link
                                href={`/creative/content?view=editor&scope=current&pageId=${facebookPageId}&id=${post.id}`}
                                className="text-[11.5px] font-bold text-[var(--accent)] hover:opacity-70"
                              >
                                Mở bài
                              </Link>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatusChip({ label, tone }: { label: string; tone: "green" | "blue" | "muted" }) {
  const classes = tone === "green"
    ? "bg-[var(--green-light)] text-[var(--green)]"
    : tone === "blue"
      ? "bg-[var(--blue-light)] text-[var(--blue)]"
      : "bg-[var(--bg-subtle)] text-[var(--text-secondary)]";
  return <span className={`rounded-[5px] px-2 py-0.5 text-[10.5px] font-bold ${classes}`}>{label}</span>;
}
