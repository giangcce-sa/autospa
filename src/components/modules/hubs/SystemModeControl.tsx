"use client";

import { Check } from "@phosphor-icons/react";
import { useExperienceMode } from "@/contexts/ExperienceModeContext";

export function SystemModeControl() {
  const { mode, setMode } = useExperienceMode();
  return <section className="mt-7 flex flex-wrap items-center justify-between gap-4 border-y border-[var(--border)] py-4"><div><h2 className="text-base font-bold">Mức độ hiển thị</h2><p className="mt-1 text-[13px] text-[var(--text-muted)]">Chế độ đơn giản ẩn các công cụ kỹ thuật khỏi công việc hằng ngày.</p></div><div className="flex rounded-md border border-[var(--border)] bg-[var(--bg-subtle)] p-1">{(["simple", "advanced"] as const).map((item) => <button key={item} onClick={() => setMode(item)} className={`flex h-9 items-center gap-2 rounded-md px-3 text-[13px] font-semibold ${mode === item ? "bg-[var(--bg-card)] text-[var(--accent)] shadow-[var(--shadow-sm)]" : "text-[var(--text-muted)]"}`}>{mode === item && <Check size={14} />}{item === "simple" ? "Đơn giản" : "Chuyên nghiệp"}</button>)}</div></section>;
}
