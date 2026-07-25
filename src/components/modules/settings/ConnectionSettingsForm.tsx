"use client";

import { useMemo, useState } from "react";
import { Key, Lightning, ShieldCheck } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { UnsavedChangesGuard } from "@/components/workspace/UnsavedChangesGuard";
import type { ConnectionSettingsDto } from "@/lib/settings/connections-policy";

type FormValue = ConnectionSettingsDto & { spaApiKey: string; spaWebhookSecret: string };
type TestState = { status: "idle" | "loading" | "success" | "error"; message: string };

function formValue(settings: ConnectionSettingsDto): FormValue {
  return { ...settings, spaApiKey: "", spaWebhookSecret: "" };
}

export function ConnectionSettingsForm({ initialSettings }: { initialSettings: ConnectionSettingsDto }) {
  const [baseline, setBaseline] = useState(() => formValue(initialSettings));
  const [value, setValue] = useState(() => formValue(initialSettings));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [test, setTest] = useState<TestState>({ status: "idle", message: "" });
  const dirty = useMemo(() => JSON.stringify(value) !== JSON.stringify(baseline), [baseline, value]);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/settings/connections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spaApiUrl: value.spaApiUrl,
          ...(value.spaApiKey ? { spaApiKey: value.spaApiKey } : {}),
          ...(value.spaWebhookSecret ? { spaWebhookSecret: value.spaWebhookSecret } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        setMessage({ type: "error", text: result.error ?? "Không thể lưu kết nối Spa" });
        return;
      }
      const next = formValue(result.data);
      setValue(next);
      setBaseline(next);
      setMessage({ type: "success", text: "Đã lưu kết nối phần mềm Spa." });
      setTest({ status: "idle", message: "" });
    } catch {
      setMessage({ type: "error", text: "Không thể kết nối máy chủ." });
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTest({ status: "loading", message: "Đang kiểm tra..." });
    try {
      const response = await fetch("/api/settings/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spaApiUrl: value.spaApiUrl,
          ...(value.spaApiKey ? { spaApiKey: value.spaApiKey } : {}),
        }),
      });
      const result = await response.json();
      setTest({
        status: response.ok && result.success ? "success" : "error",
        message: result.message ?? result.error ?? "Kiểm tra thất bại",
      });
    } catch {
      setTest({ status: "error", message: "Không thể kết nối máy chủ" });
    }
  };

  return (
    <div className="max-w-3xl space-y-4">
      <UnsavedChangesGuard active={dirty} />
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lightning size={17} className="text-[var(--accent)]" aria-hidden="true" />
            <CardTitle>Phần mềm Spa</CardTitle>
          </div>
          <Badge variant={value.hasSpaApiKey ? "success" : "neutral"}>
            {value.hasSpaApiKey ? "Đã có API key" : "Chưa có API key"}
          </Badge>
        </CardHeader>
        <fieldset disabled={saving} className="space-y-4 disabled:opacity-70">
          <Input
            label="Spa API URL"
            type="url"
            value={value.spaApiUrl}
            onChange={(event) => setValue((current) => ({ ...current, spaApiUrl: event.target.value }))}
            placeholder="https://api.example-spa.vn"
            hint="Bắt buộc HTTPS. Host production có thể giới hạn thêm bằng SPA_API_ALLOWED_HOSTS."
          />
          <Input
            label="Spa API key"
            type="password"
            value={value.spaApiKey}
            onChange={(event) => setValue((current) => ({ ...current, spaApiKey: event.target.value }))}
            placeholder={value.hasSpaApiKey ? "Để trống = giữ khóa hiện tại" : "Nhập bearer token"}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={testConnection} loading={test.status === "loading"}>
              Kiểm tra kết nối
            </Button>
            {test.status !== "idle" ? (
              <p role="status" className={`text-sm ${test.status === "success" ? "text-[var(--success)]" : test.status === "error" ? "text-[var(--danger)]" : "text-[var(--text-muted)]"}`}>
                {test.message}
              </p>
            ) : null}
          </div>
        </fieldset>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck size={17} className="text-[var(--accent)]" aria-hidden="true" />
            <CardTitle>Webhook từ Spa</CardTitle>
          </div>
          <Badge variant={value.hasSpaWebhookSecret ? "success" : "neutral"}>
            {value.hasSpaWebhookSecret ? "Đã bảo vệ" : "Chưa cấu hình"}
          </Badge>
        </CardHeader>
        <div className="space-y-4">
          <Input
            label="Webhook secret"
            type="password"
            value={value.spaWebhookSecret}
            onChange={(event) => setValue((current) => ({ ...current, spaWebhookSecret: event.target.value }))}
            placeholder={value.hasSpaWebhookSecret ? "Để trống = giữ secret hiện tại" : "Nhập secret xác thực webhook"}
            hint="Phần mềm Spa gửi secret qua x-spa-webhook-secret hoặc Authorization Bearer tới /api/spa."
          />
          <div className="flex items-start gap-2 rounded-md border border-[var(--border)] bg-[var(--bg-subtle)] p-3 text-sm text-[var(--text-secondary)]">
            <Key size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            Secret không bao giờ được trả lại trình duyệt. Để trống giữ nguyên giá trị hiện tại.
          </div>
        </div>
      </Card>

      {message ? (
        <p role={message.type === "error" ? "alert" : "status"} className={`text-sm ${message.type === "success" ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
          {message.text}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} loading={saving} disabled={!dirty}>Lưu kết nối</Button>
        {dirty ? <span className="text-xs font-semibold text-[var(--warning)]">Có thay đổi chưa lưu</span> : null}
      </div>
    </div>
  );
}
