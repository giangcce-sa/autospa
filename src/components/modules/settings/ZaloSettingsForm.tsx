"use client";

import { useMemo, useState } from "react";
import { Lightning } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { UnsavedChangesGuard } from "@/components/workspace/UnsavedChangesGuard";
import type { ZaloSettingsDto } from "@/lib/settings/channels-policy";

type FormValue = ZaloSettingsDto & { zaloToken: string };
type ResultState = { status: "idle" | "loading" | "success" | "error"; message: string };

function formValue(settings: ZaloSettingsDto): FormValue {
  return { ...settings, zaloToken: "" };
}

export function ZaloSettingsForm({ initialSettings, endpoint = "/api/settings/channels" }: {
  initialSettings: ZaloSettingsDto;
  endpoint?: string;
}) {
  const [baseline, setBaseline] = useState(() => formValue(initialSettings));
  const [value, setValue] = useState(() => formValue(initialSettings));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [test, setTest] = useState<ResultState>({ status: "idle", message: "" });
  const dirty = useMemo(() => JSON.stringify(value) !== JSON.stringify(baseline), [baseline, value]);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zaloOaId: value.zaloOaId,
          ...(value.zaloToken ? { zaloToken: value.zaloToken } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        setMessage({ type: "error", text: result.error ?? "Không thể lưu Zalo" });
        return;
      }
      const next = formValue(result.data);
      setValue(next);
      setBaseline(next);
      setMessage({ type: "success", text: "Đã lưu cấu hình Zalo OA." });
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
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value.zaloToken ? { zaloToken: value.zaloToken } : {}),
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
    <Card>
      <UnsavedChangesGuard active={dirty} />
      <CardHeader>
        <div className="flex items-center gap-2">
          <Lightning size={16} weight="fill" className="text-[#0068FF]" aria-hidden="true" />
          <CardTitle>Zalo OA</CardTitle>
          <Badge variant={value.hasZaloToken ? "success" : "neutral"}>{value.hasZaloToken ? "Đã có token" : "Chưa cấu hình"}</Badge>
        </div>
        <Button size="sm" variant="secondary" loading={test.status === "loading"} onClick={testConnection}>Kiểm tra kết nối</Button>
      </CardHeader>
      <fieldset disabled={saving} className="space-y-3 disabled:opacity-70">
        <Input
          label="Zalo Access Token"
          type="password"
          placeholder={value.hasZaloToken ? "Để trống = giữ token hiện tại" : "Token từ Zalo OA"}
          value={value.zaloToken}
          onChange={(event) => setValue((current) => ({ ...current, zaloToken: event.target.value }))}
        />
        <Input
          label="Zalo OA ID"
          placeholder="ID Official Account"
          value={value.zaloOaId}
          onChange={(event) => setValue((current) => ({ ...current, zaloOaId: event.target.value }))}
        />
      </fieldset>
      {test.status !== "idle" ? <p role="status" className={`mt-2 text-xs ${test.status === "success" ? "text-[var(--success)]" : test.status === "error" ? "text-[var(--danger)]" : "text-[var(--text-muted)]"}`}>{test.message}</p> : null}
      {message ? <p role={message.type === "error" ? "alert" : "status"} className={`mt-2 text-xs ${message.type === "success" ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>{message.text}</p> : null}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button onClick={save} loading={saving} disabled={!dirty}>Lưu Zalo</Button>
        {dirty ? <span className="text-xs font-semibold text-[var(--warning)]">Có thay đổi chưa lưu</span> : null}
      </div>
    </Card>
  );
}
