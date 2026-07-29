"use client";

import { useMemo, useState } from "react";
import { Archive, DownloadSimple } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { UnsavedChangesGuard } from "@/components/workspace/UnsavedChangesGuard";
import type { DataSettingsDto } from "@/lib/settings/data-policy";

export function DataSettingsForm({ initialSettings }: { initialSettings: DataSettingsDto }) {
  const [baseline, setBaseline] = useState(initialSettings);
  const [value, setValue] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const dirty = useMemo(() => JSON.stringify(value) !== JSON.stringify(baseline), [baseline, value]);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/settings/data", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        setMessage({ type: "error", text: result.error ?? "Không thể lưu cấu hình dữ liệu" });
        return;
      }
      setValue(result.data);
      setBaseline(result.data);
      setMessage({ type: "success", text: "Đã lưu chính sách dữ liệu." });
    } catch {
      setMessage({ type: "error", text: "Không thể kết nối máy chủ." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-4">
      <UnsavedChangesGuard active={dirty} />
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Archive size={17} className="text-[var(--accent)]" aria-hidden="true" />
            <CardTitle>Thời gian lưu nội dung</CardTitle>
          </div>
        </CardHeader>
        <fieldset disabled={saving} className="grid gap-4 disabled:opacity-70 md:grid-cols-2">
          <Input
            label="Giữ bài nháp (ngày)"
            type="number"
            min={0}
            max={3650}
            step={1}
            value={value.draftRetentionDays}
            onChange={(event) => setValue((current) => ({ ...current, draftRetentionDays: Number(event.target.value) }))}
            hint="Nhập 0 để giữ không giới hạn. Tối đa 3650 ngày."
          />
          <Input
            label="Giữ bài đã đăng (ngày)"
            type="number"
            min={0}
            max={3650}
            step={1}
            value={value.publishedRetentionDays}
            onChange={(event) => setValue((current) => ({ ...current, publishedRetentionDays: Number(event.target.value) }))}
            hint="Nhập 0 để giữ không giới hạn. Tối đa 3650 ngày."
          />
        </fieldset>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <DownloadSimple size={17} className="text-[var(--accent)]" aria-hidden="true" />
            <CardTitle>Xuất dữ liệu đã loại bỏ secrets</CardTitle>
          </div>
        </CardHeader>
        <p className="text-sm leading-6 text-[var(--text-secondary)]">
          File JSON gzip chứa một phần dữ liệu vận hành và loại bỏ API key, access token, webhook secret và mật khẩu. Đây không phải bản backup PostgreSQL dùng cho disaster recovery.
        </p>
        <a
          href="/api/backup"
          download
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-foreground)]"
        >
          <DownloadSimple size={15} aria-hidden="true" /> Tải JSON export
        </a>
      </Card>

      {message ? (
        <p role={message.type === "error" ? "alert" : "status"} className={`text-sm ${message.type === "success" ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
          {message.text}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} loading={saving} disabled={!dirty}>Lưu cấu hình dữ liệu</Button>
        {dirty ? <span className="text-xs font-semibold text-[var(--warning)]">Có thay đổi chưa lưu</span> : null}
      </div>
    </div>
  );
}
